import { NextResponse } from "next/server";
import { deleteJobForUser } from "@/lib/supabase/jobs-mutate";
import { getJobById, updateJob } from "@/lib/supabase/jobs";
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

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await assertJobAccess(id);
    const job = await getJobById(id);
    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    return NextResponse.json({ job });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load job";
    const status = message.includes("Not authorized")
      ? 403
      : message.includes("not found")
        ? 404
        : message.includes("Sign in")
          ? 401
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await assertJobAccess(id);
    const body = (await request.json()) as Record<string, unknown>;
    const job = await updateJob(id, body);
    return NextResponse.json({ job });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update job";
    const status = message.includes("Not authorized")
      ? 403
      : message.includes("not found")
        ? 404
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    await deleteJobForUser(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete job";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
