import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function isCronAuthorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!isCronAuthorised(request)) {
    return NextResponse.json(
      { error: "Unauthorised" },
      { status: 401 },
    );
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { data: expired, error } = await supabase
      .from("candidates")
      .select("id, resume_file_path")
      .not("resume_file_path", "is", null)
      .lt("resume_delete_after", new Date().toISOString());

    if (error) throw new Error(error.message);
    if (!expired || expired.length === 0) {
      return NextResponse.json({ ok: true, deleted: 0 });
    }

    const paths = expired
      .map((c) => c.resume_file_path as string)
      .filter(Boolean);

    if (paths.length > 0) {
      const { error: storageError } = await supabase
        .storage
        .from("resumes")
        .remove(paths);
      if (storageError) throw new Error(storageError.message);
    }

    const ids = expired.map((c) => c.id as string);
    await supabase
      .from("candidates")
      .update({
        resume_file_path: null,
        resume_delete_after: null,
      })
      .in("id", ids);

    return NextResponse.json({
      ok: true,
      deleted: paths.length,
      candidates: ids.length,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Cleanup failed";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
