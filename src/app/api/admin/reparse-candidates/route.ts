import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin/auth";
import { classifyApplicantPrefilter } from "@/lib/jobs/applicant-prefilter";
import { reparseCandidateRecord } from "@/lib/candidates/reparse-candidate-record";
import { getJobById } from "@/lib/supabase/jobs";
import { listCandidates, updateCandidate } from "@/lib/supabase/candidates";

export const maxDuration = 120;

function hasStoredResumeText(text: string | null | undefined): boolean {
  return Boolean(text?.trim());
}

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();

    const { searchParams } = new URL(request.url);
    const offset = Math.max(0, Number(searchParams.get("offset") ?? 0));
    const limit = Math.min(
      50,
      Math.max(1, Number(searchParams.get("limit") ?? 25)),
    );

    const all = await listCandidates();
    const withResume = all.filter((c) => hasStoredResumeText(c.resume_text));
    const total = withResume.length;
    const batch = withResume.slice(offset, offset + limit);
    const results: { id: string; name: string }[] = [];
    let updatedInBatch = 0;

    for (const row of batch) {
      const previousName = row.display_name?.trim() ?? "";
      const update = reparseCandidateRecord(row);
      const nameChanged =
        update.display_name.trim() !== previousName ||
        update.signal_profile.display_name?.trim() !==
          row.signal_profile?.display_name?.trim();

      const patch: Record<string, unknown> = {
        display_name: update.display_name,
        resume_text: update.resume_text,
        signal_profile: update.signal_profile,
        application_email: update.application_email,
        application_phone: update.application_phone,
        linkedin_url: update.linkedin_url,
      };

      if (
        row.job_id &&
        row.scoring_status !== "scored" &&
        row.scoring_status !== "skipped" &&
        row.scoring_status !== "manually_rejected"
      ) {
        const roleBrief = await getJobById(row.job_id);
        if (roleBrief) {
          patch.scoring_status = classifyApplicantPrefilter(
            roleBrief,
            update.signal_profile,
            update.resume_text,
          );
        }
      }

      await updateCandidate(update.id, patch);

      if (nameChanged) updatedInBatch += 1;
      results.push({ id: update.id, name: update.display_name });
    }

    const processed = offset + batch.length;
    return NextResponse.json({
      ok: true,
      total,
      processed,
      updatedInBatch,
      batchSize: batch.length,
      done: processed >= total,
      results,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reparse candidates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
