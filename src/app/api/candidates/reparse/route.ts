import { NextResponse } from "next/server";
import { buildSignalProfile } from "@/lib/candidates/build-signal-profile";
import { getCandidateHeaderName } from "@/lib/candidates/profile-display";
import { normalizeResumeText } from "@/lib/resume/normalize-resume-text";
import { listCandidates, updateCandidate } from "@/lib/supabase/candidates";

export const maxDuration = 120;

export async function POST() {
  try {
    const rows = await listCandidates();
    const results: { id: string; name: string }[] = [];

    for (const row of rows) {
      const resumeText = normalizeResumeText(row.resume_text);
      const filename = row.resume_filename ?? "candidate.pdf";
      const signal_profile = buildSignalProfile(resumeText, filename);
      const display_name = getCandidateHeaderName(signal_profile);

      await updateCandidate(row.id, {
        display_name,
        resume_text: resumeText,
        signal_profile: { ...signal_profile, display_name },
      });

      results.push({ id: row.id, name: display_name });
    }

    return NextResponse.json({
      ok: true,
      total: results.length,
      results,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reparse candidates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
