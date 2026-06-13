import { after } from "next/server";
import { NextResponse } from "next/server";
import { computeResumeContentHash } from "@/lib/candidates/resume-content-hash";
import { storeUploadedResumeForCandidate } from "@/lib/candidates/store-uploaded-resume";
import { createActivity } from "@/lib/candidates/activity";
import { trackEvent } from "@/lib/analytics/track";
import { triggerParsing } from "@/lib/ingestion/trigger-parsing";
import { extractResumeTextFromBytes } from "@/lib/resume/parse-resume";
import { normalizeResumeText } from "@/lib/resume/normalize-resume-text";
import { getAuthenticatedUserId } from "@/lib/supabase/created-by";
import {
  insertCandidate,
  listCandidatesWithSummaries,
} from "@/lib/supabase/candidates";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { limitErrorResponse } from "@/lib/workspace/limits";
import { filenameToDisplayName } from "@/lib/scoring/recruiter-card";

export const maxDuration = 60;

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const candidates = await listCandidatesWithSummaries(user.id);
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
        resumeFilename:
          String(form.get("resumeFilename") ?? "").trim() || undefined,
        displayName: String(form.get("displayName") ?? "").trim() || undefined,
        jobId: String(form.get("jobId") ?? "").trim() || undefined,
        source: String(form.get("source") ?? "").trim() || undefined,
        forceUpload: form.get("forceUpload") === "true",
      },
      resumeFile:
        resumeFile instanceof File && resumeFile.size > 0 ? resumeFile : null,
    };
  }

  const json = (await request.json()) as PostBody;
  return { body: json, resumeFile: null };
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const { body, resumeFile } = await parsePostInput(request);
    const resumeFilename =
      body.resumeFilename?.trim() ||
      resumeFile?.name?.trim() ||
      "candidate-resume.pdf";

    let resumeText = normalizeResumeText(coerceResumeText(body.resumeText));
    if (!resumeText && resumeFile) {
      try {
        resumeText = await extractResumeTextFromBytes(
          await resumeFile.arrayBuffer(),
          resumeFilename,
        );
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Resume extraction failed";
        return NextResponse.json({ error: message }, { status: 422 });
      }
    }

    if (!resumeText) {
      return NextResponse.json(
        { error: "Resume text or file is required." },
        { status: 400 },
      );
    }

    if (resumeText.length > 50000) {
      return NextResponse.json(
        { error: "Resume text exceeds 50,000 characters." },
        { status: 400 },
      );
    }

    const resumeHash = computeResumeContentHash(resumeText);

    if (!body.forceUpload) {
      const { data: hashMatch } = await supabase
        .from("candidates")
        .select("id, display_name")
        .eq("resume_content_hash", resumeHash)
        .eq("created_by", user.id)
        .maybeSingle();

      if (hashMatch) {
        return NextResponse.json(
          {
            error: "duplicate",
            existingId: hashMatch.id,
            existingName: hashMatch.display_name,
          },
          { status: 409 },
        );
      }
    }

    const jobId = body.jobId?.trim() || null;
    const source = body.source?.trim() || (jobId ? "uploaded" : "uploaded");
    const displayName =
      body.displayName?.trim() || filenameToDisplayName(resumeFilename);

    const { id } = await insertCandidate({
      display_name: displayName,
      resume_filename: resumeFilename,
      resume_text: resumeText,
      resume_content_hash: resumeHash,
      signal_profile: {},
      activity: [createActivity("added", "Candidate added")],
      parsing_status: "pending",
      scoring_status: "unscored",
      ...(jobId
        ? {
            job_id: jobId,
            source,
            applied_at: new Date().toISOString(),
          }
        : {}),
    });

    if (resumeFile) {
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
        console.warn(
          `[candidates] Resume file storage failed for ${id}:`,
          storageErr,
        );
      }
    }

    const { error: ingestionJobError } = await supabase
      .from("candidate_ingestion_jobs")
      .insert({
        candidate_id: id,
        job_id: jobId,
        owner_user_id: user.id,
        status: "pending",
      });
    if (ingestionJobError) {
      console.warn(
        `[candidates] Ingestion job insert failed for ${id}:`,
        ingestionJobError.message,
      );
    }

    const { count } = await supabase
      .from("candidates")
      .select("*", { count: "exact", head: true })
      .eq("created_by", user.id)
      .in("parsing_status", ["parsing", "pending"]);

    const activeParses = count ?? 0;
    const MAX_CONCURRENT_PARSES = 10;

    if (activeParses < MAX_CONCURRENT_PARSES) {
      const candidateId = id;
      const ownerUserId = user.id;
      after(async () => {
        try {
          await triggerParsing(
            candidateId,
            resumeText,
            resumeFilename,
            jobId,
            ownerUserId,
          );
        } catch (err) {
          console.error(
            "[after] triggerParsing failed:",
            JSON.stringify({
              candidateId,
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      });
    } else {
      console.log(
        `[upload] Parse deferred for ${id} — ${activeParses} active`,
      );
    }

    void trackEvent("candidate_uploaded", {
      candidate_id: id,
      job_id: jobId,
      source,
    });

    return NextResponse.json({
      id,
      display_name: displayName,
      parsing_status: "pending",
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
