import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { getAuthenticatedUserId } from "@/lib/supabase/created-by";
import { updateJob } from "@/lib/supabase/jobs";

type Params = { params: Promise<{ id: string }> };

async function assertJobOwner(jobId: string): Promise<void> {
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

function shareUrlForToken(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return `${base}/share/${token}`;
}

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id: jobId } = await params;
    await assertJobOwner(jobId);

    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    await updateJob(jobId, {
      share_token: token,
      share_enabled: true,
    });

    return NextResponse.json({
      token,
      shareUrl: shareUrlForToken(token),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to enable sharing";
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

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id: jobId } = await params;
    await assertJobOwner(jobId);
    await updateJob(jobId, { share_enabled: false });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to disable sharing";
    const status = message.includes("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
