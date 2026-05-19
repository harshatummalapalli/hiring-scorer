import { NextResponse } from "next/server";
import { classifyApplicantPrefilter } from "@/lib/jobs/applicant-prefilter";
import { isPostScoreStatus } from "@/lib/jobs/scoring-status";
import { getJobById } from "@/lib/supabase/jobs";
import { listCandidatesByJob, updateCandidate } from "@/lib/supabase/candidates";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id: jobId } = await params;
    const roleBrief = await getJobById(jobId);
    if (!roleBrief) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    const rows = await listCandidatesByJob(jobId);
    let updated = 0;
    let movedToUnlikely = 0;

    for (const row of rows) {
      if (!row.resume_text?.trim()) continue;
      if (isPostScoreStatus(row.scoring_status)) {
        continue;
      }
      const status = classifyApplicantPrefilter(
        roleBrief,
        row.signal_profile,
        row.resume_text,
      );
      if (status !== row.scoring_status) {
        await updateCandidate(row.id, { scoring_status: status });
        updated += 1;
      }
      if (status === "low_relevance") movedToUnlikely += 1;
    }

    return NextResponse.json({
      ok: true,
      total: rows.length,
      updated,
      movedToUnlikely,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reclassify applicants";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
