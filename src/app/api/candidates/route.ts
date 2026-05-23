import { NextResponse } from "next/server";
import { storeUploadedResumeForCandidate } from "@/lib/candidates/store-uploaded-resume";
import { ingestResumeFromBytes, ingestResumeFromText } from "@/lib/ingestion/ingest-resume";
import { persistResumeIntelligence } from "@/lib/ingestion/persist-intelligence";
import {
  findDuplicateCandidates,
  type DuplicateMatch,
} from "@/lib/candidates/duplicate-detection";
import {
  enrichGithubProfile,
  extractGithubUsername,
} from "@/lib/candidates/github-enrichment";
import { classifyApplicantPrefilter } from "@/lib/jobs/applicant-prefilter";
import { triggerAutoEvaluation } from "@/lib/scoring/evaluation-queue";
import { getCandidateHeaderName } from "@/lib/candidates/profile-display";
import { createActivity } from "@/lib/candidates/activity";
import { normalizeResumeText } from "@/lib/resume/normalize-resume-text";
import { getAuthenticatedUserId } from "@/lib/supabase/created-by";
import {
  insertCandidate,
  listCandidatesWithSummaries,
} from "@/lib/supabase/candidates";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { limitErrorResponse } from "@/lib/workspace/limits";
import { parseRoleBriefRow } from "@/types/role-brief";
import type { CandidateScoringStatus } from "@/types/job";

export const maxDuration = 60;

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const candidates = await listCandidatesWithSummaries();
    return NextResponse.json({ candidates });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list candidates";
    const status = message.includes("Supabase") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

type PostBody = {
  resumeText: string;
  resumeFilename?: string;
  displayName?: string;
  jobId?: string;
  source?: string;
  forceUpload?: boolean;
};

function coerceResumeText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (
    value != null &&
    typeof value === "object" &&
    "stripped" in value &&
    typeof (value as { stripped: unknown }).stripped === "string"
  ) {
    return (value as { stripped: string }).stripped.trim();
  }
  return "";
}

function isMultipart(request: Request): boolean {
  const ct = request.headers.get("content-type") ?? "";
  return ct.includes("multipart/form-data");
}

async function parsePostInput(request: Request): Promise<{
  body: PostBody;
  resumeFile: File | null;
}> {
  if (isMultipart(request)) {
    const form = await request.formData();
    const resumeFile = form.get("resumeFile");
    return {
      body: {
        resumeText: coerceResumeText(form.get("resumeText")),
        resumeFilename: String(form.get("resumeFilename") ?? "").trim() || undefined,
        displayName: String(form.get("displayName") ?? "").trim() || undefined,
        jobId: String(form.get("jobId") ?? "").trim() || undefined,
        source: String(form.get("source") ?? "").trim() || undefined,
        forceUpload: form.get("forceUpload") === "true",
      },
      resumeFile: resumeFile instanceof File && resumeFile.size > 0 ? resumeFile : null,
    };
  }

  const json = (await request.json()) as PostBody;
  return { body: json, resumeFile: null };
}

export async function POST(request: Request) {
  try {
    const { body, resumeFile } = await parsePostInput(request);
    const resumeText = normalizeResumeText(coerceResumeText(body.resumeText));
    if (!resumeText && !resumeFile) {
      return NextResponse.json(
        { error: "Resume text or file is required." },
        { status: 400 },
      );
    }
    const resumeFilename =
      body.resumeFilename?.trim() ||
      resumeFile?.name?.trim() ||
      "candidate-resume.pdf";

    let ingested;
    try {
      if (resumeFile) {
        const bytes = await resumeFile.arrayBuffer();
        ingested = await ingestResumeFromBytes(
          bytes,
          resumeFilename,
          resumeFile.type,
          resumeText,
        );
      } else {
        ingested = await ingestResumeFromText(resumeText, resumeFilename);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Resume parsing failed";
      console.error("[candidates/route] Ingest error:", message);
      return NextResponse.json(
        {
          error:
            "Could not process this resume. " +
            "The parsing service may be unavailable. " +
            "Please try again in a moment.",
          detail: message,
        },
        { status: 422 },
      );
    }
    const signal_profile = ingested.signalProfile;
    const resumeTextFinal = ingested.resumeText;
    if (resumeTextFinal.length > 50000) {
      return NextResponse.json(
        { error: "Resume text exceeds 50,000 characters." },
        { status: 400 },
      );
    }
    const display_name =
      body.displayName?.trim() || getCandidateHeaderName(signal_profile);

    if (!body.forceUpload) {
      const duplicates = await findDuplicateCandidates({
        resumeText: resumeTextFinal,
        displayName: display_name,
      });
      const primary = duplicates[0];
      const duplicateConfidence = (match: DuplicateMatch): number => {
        if (match.level === "content_hash") return 1;
        if (match.level === "email") return 0.95;
        return match.similarity ?? 0;
      };
      if (primary && duplicateConfidence(primary) >= 0.85) {
        return NextResponse.json(
          {
            error: "duplicate",
            message:
              "This resume matches an existing candidate in your workspace.",
            existingId: primary.candidateId,
            existingName: primary.displayName,
          },
          { status: 409 },
        );
      }
    }

    const githubUser = extractGithubUsername(resumeText);
    const githubData = githubUser
      ? await enrichGithubProfile(githubUser)
      : null;

    const activity = [
      createActivity("added", "Candidate added to talent pool"),
    ];

    const profile = {
      ...signal_profile,
      display_name,
      ...(githubData ? { github: githubData } : {}),
    };

    const jobId = body.jobId?.trim() || null;
    const source = body.source?.trim() || (jobId ? "uploaded" : "uploaded");

    let scoringStatus: CandidateScoringStatus | undefined;
    if (jobId) {
      const supabase = await createSupabaseServerClient();
      const { data: briefRow } = await supabase
        .from("role_briefs")
        .select("*")
        .eq("id", jobId)
        .maybeSingle();
      if (briefRow) {
        const roleBrief = parseRoleBriefRow(briefRow as Record<string, unknown>);
        scoringStatus = classifyApplicantPrefilter(
          roleBrief,
          profile,
          resumeTextFinal,
        );
      } else {
        scoringStatus = "unscored";
      }
    }

    const { id } = await insertCandidate({
      display_name,
      resume_filename: resumeFilename,
      resume_text: resumeTextFinal,
      signal_profile: profile,
      activity,
      application_email: profile.extracted_email ?? null,
      application_phone: profile.extracted_phone ?? null,
      linkedin_url: profile.linkedin_url ?? null,
      ...(jobId
        ? {
            job_id: jobId,
            source,
            scoring_status: scoringStatus ?? "unscored",
            applied_at: new Date().toISOString(),
          }
        : {}),
    });

    if (ingested.structuredResume) {
      const persisted = await persistResumeIntelligence({
        candidateId: id,
        structuredResume: ingested.structuredResume,
        parseResult: ingested.parseResult,
      });
      if (persisted.errors.length) {
        console.warn(
          `[candidates] ingestion persist warnings for ${id}:`,
          persisted.errors.join("; "),
        );
      }
    }

    if (resumeFile) {
      const supabase = await createSupabaseServerClient();
      const userId = await getAuthenticatedUserId(supabase);
      try {
        await storeUploadedResumeForCandidate(
          supabase,
          userId,
          id,
          jobId,
          resumeFile,
        );
      } catch (storageErr) {
        const message =
          storageErr instanceof Error
            ? storageErr.message
            : "Failed to store resume file";
        return NextResponse.json(
          {
            error: `Candidate created but resume file could not be stored: ${message}`,
            id,
          },
          { status: 500 },
        );
      }
    }

    if (scoringStatus === "unscored" && jobId) {
      void triggerAutoEvaluation(id, jobId, request);
    }

    return NextResponse.json({
      id,
      display_name,
      signal_profile: profile,
      extractionSource: ingested.ingestionSource,
    });
  } catch (err) {
    const limited = limitErrorResponse(err);
    if (limited) {
      return NextResponse.json(limited.body, { status: limited.status });
    }
    const message =
      err instanceof Error ? err.message : "Failed to create candidate";
    const status = message.includes("does not exist")
      ? 503
      : message.includes("Supabase")
        ? 503
        : 500;
    const hint =
      message.includes("does not exist") ||
      message.toLowerCase().includes("relation") ||
      message.toLowerCase().includes("candidates")
        ? "Run supabase/candidates.sql in your Supabase SQL editor."
        : undefined;
    return NextResponse.json(
      { error: message, ...(hint ? { hint } : {}) },
      { status },
    );
  }
}
