import { NextResponse } from "next/server";
import { recomputeSavedScoresForJob } from "@/lib/jobs/recompute-job-scores";
import { getJobById } from "@/lib/supabase/jobs";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { getAuthenticatedUserId } from "@/lib/supabase/created-by";

type Params = { params: Promise<{ id: string }> };

async function assertJobAccess(jobId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId(supabase);
  const { data, error } = await supabase
    .from("role_briefs")
    .select("id, created_by")
    .eq("id", jobId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Job not found.");
  if (String(data.created_by) !== userId) {
    throw new Error("Not authorized to access this job.");
  }
}

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id: jobId } = await params;
    await assertJobAccess(jobId);

    const job = await getJobById(jobId);
    if (!job) {
      return NextResponse.json(
        { error: "Role brief not found." },
        { status: 404 },
      );
    }

    const { updatedCount } = await recomputeSavedScoresForJob(jobId, {
      weight_skills: job.weight_skills,
      weight_trajectory: job.weight_trajectory,
      weight_domain: job.weight_domain,
      weight_seniority: job.weight_seniority,
      weight_tenure: job.weight_tenure,
    });

    return NextResponse.json({ updated: updatedCount });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Recalibration failed";
    const status = message.includes("Not authorized")
      ? 403
      : message.includes("not found")
        ? 404
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
