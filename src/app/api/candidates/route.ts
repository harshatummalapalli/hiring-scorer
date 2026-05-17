import { NextResponse } from "next/server";
import { storeUploadedResumeForCandidate } from "@/lib/candidates/store-uploaded-resume";
import { buildSignalProfile } from "@/lib/candidates/build-signal-profile";
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

export const maxDuration = 60;

export async function GET() {
  try {
    const candidates = await listCandidatesWithSummaries();
    return NextResponse.json({ candidates });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list candidates";
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
    if (!resumeText) {
      return NextResponse.json(
        { error: "Resume text is required." },
        { status: 400 },
      );
    }
    if (resumeText.length > 50000) {
      return NextResponse.json(
        { error: "Resume text exceeds 50,000 characters." },
        { status: 400 },
      );
    }

    const resumeFilename =
      body.resumeFilename?.trim() ||
      resumeFile?.name?.trim() ||
      "candidate-resume.pdf";

    const signal_profile = buildSignalProfile(resumeText, resumeFilename);
    const display_name =
      body.displayName?.trim() || getCandidateHeaderName(signal_profile);

    const activity = [
      createActivity("added", "Candidate added to talent pool"),
    ];

    const profile = { ...signal_profile, display_name };

    const jobId = body.jobId?.trim() || null;
    const source = body.source?.trim() || (jobId ? "uploaded" : "uploaded");

    const { id } = await insertCandidate({
      display_name,
      resume_filename: resumeFilename,
      resume_text: resumeText,
      signal_profile: profile,
      activity,
      ...(jobId
        ? {
            job_id: jobId,
            source,
            scoring_status: "unscored",
            applied_at: new Date().toISOString(),
          }
        : {}),
    });

    if (resumeFile) {
      const supabase = await createSupabaseServerClient();
      const userId = await getAuthenticatedUserId(supabase);
      try {
        await storeUploadedResumeForCandidate(userId, id, jobId, resumeFile);
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

    return NextResponse.json({
      id,
      display_name,
      signal_profile: profile,
      extractionSource: "code",
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
