import { NextResponse } from "next/server";
import { triggerAutoEvaluation } from "@/lib/scoring/evaluation-queue";
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

export async function POST(request: Request, { params }: Params) {
  try {
    const { id: jobId } = await params;
    await assertJobAccess(jobId);
    const supabase = await createSupabaseServerClient();

    const { data: rows, error: fetchError } = await supabase
      .from("candidates")
      .select("id")
      .eq("job_id", jobId)
      .eq("scoring_status", "scored");

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to load candidates." },
        { status: 500 },
      );
    }

    const { error } = await supabase
      .from("candidates")
      .update({ scoring_status: "needs_scoring" })
      .eq("job_id", jobId)
      .eq("scoring_status", "scored");

    if (error) {
      return NextResponse.json(
        { error: "Failed to mark candidates stale." },
        { status: 500 },
      );
    }

    for (const row of rows ?? []) {
      const candidateId = row.id != null ? String(row.id) : "";
      if (!candidateId) continue;
      void triggerAutoEvaluation(candidateId, jobId);
    }

    return NextResponse.json({
      ok: true,
      queued: rows?.length ?? 0,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to mark candidates stale";
    const status = message.includes("Not authorized")
      ? 403
      : message.includes("not found")
        ? 404
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
