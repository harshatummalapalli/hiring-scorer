import { NextResponse } from "next/server";
import { buildSignalProfile } from "@/lib/candidates/build-signal-profile";
import { createActivity } from "@/lib/candidates/activity";
import {
  insertCandidate,
  listCandidatesWithSummaries,
} from "@/lib/supabase/candidates";

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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PostBody;
    const resumeText = coerceResumeText(body.resumeText);
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
      body.resumeFilename?.trim() || "candidate-resume.pdf";
    const signal_profile = buildSignalProfile(resumeText, resumeFilename);
    const display_name =
      body.displayName?.trim() || signal_profile.display_name;

    const activity = [
      createActivity("added", "Candidate added to talent pool"),
    ];

    const { id } = await insertCandidate({
      display_name,
      resume_filename: resumeFilename,
      resume_text: resumeText,
      signal_profile: { ...signal_profile, display_name },
      activity,
    });

    return NextResponse.json({ id, signal_profile });
  } catch (err) {
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
