import { NextResponse } from "next/server";
import { recomputeSavedScoresForJob } from "@/lib/jobs/recompute-job-scores";
import { updateJob } from "@/lib/supabase/jobs";
import { getAuthenticatedUserId } from "@/lib/supabase/created-by";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";

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

function clampWeight(n: unknown): number {
  const v = Number(n);
  if (Number.isNaN(v)) return 5;
  return Math.max(1, Math.min(10, Math.round(v)));
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await assertJobAccess(id);
    const body = (await request.json()) as Record<string, unknown>;

    const weights = {
      weight_skills: clampWeight(body.weight_skills),
      weight_trajectory: clampWeight(body.weight_trajectory),
      weight_domain: clampWeight(body.weight_domain),
      weight_seniority: clampWeight(body.weight_seniority),
      weight_tenure: clampWeight(body.weight_tenure),
    };

    const job = await updateJob(id, weights);

    const supabase = await createSupabaseServerClient();
    const { count, error: countError } = await supabase
      .from("saved_scores")
      .select("id", { count: "exact", head: true })
      .eq("role_brief_id", id);

    if (countError) throw new Error(countError.message);

    const evaluatedCount = count ?? 0;
    let recomputedCount = 0;
    if (evaluatedCount > 0) {
      const result = await recomputeSavedScoresForJob(id, weights);
      recomputedCount = result.updatedCount;
    }

    return NextResponse.json({
      job,
      evaluatedCount,
      recomputedCount,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to save hiring bar";
    const status = message.includes("Not authorized")
      ? 403
      : message.includes("not found")
        ? 404
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
