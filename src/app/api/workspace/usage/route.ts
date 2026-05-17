import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/created-by";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { getWorkspaceUsage } from "@/lib/workspace/limits";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const userId = await getAuthenticatedUserId(supabase);
    const usage = await getWorkspaceUsage(supabase, userId);

    return NextResponse.json({
      jobs: {
        current: usage.current_job_count,
        max: usage.max_jobs,
      },
      candidates: {
        current: usage.current_candidate_count,
        max: usage.max_candidates,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load workspace usage";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
