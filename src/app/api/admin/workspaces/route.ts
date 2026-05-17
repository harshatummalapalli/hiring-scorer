import { NextResponse } from "next/server";
import { assertSuperAdminApi } from "@/lib/admin/api-guard";
import { fetchAdminWorkspaces } from "@/lib/admin/queries";

export async function GET(request: Request) {
  const guard = await assertSuperAdminApi();
  if (guard instanceof NextResponse) return guard;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;

  try {
    const workspaces = await fetchAdminWorkspaces(q);
    return NextResponse.json({ workspaces });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load workspaces";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
