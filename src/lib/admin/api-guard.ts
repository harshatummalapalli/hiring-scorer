import { NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/admin/auth";

export async function assertSuperAdminApi(): Promise<
  { ok: true; userId: string } | NextResponse
> {
  const supabase = await import("@/lib/supabase/server-auth").then((m) =>
    m.createSupabaseServerClient(),
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await isSuperAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return { ok: true, userId: user.id };
}
