import { NextResponse } from "next/server";
import { assertSuperAdminApi } from "@/lib/admin/api-guard";
import { fetchAdminWorkspaceDetail } from "@/lib/admin/queries";

type Params = { params: Promise<{ userId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const guard = await assertSuperAdminApi();
  if (guard instanceof NextResponse) return guard;

  const { userId } = await params;

  try {
    const detail = await fetchAdminWorkspaceDetail(userId);
    if (!detail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load workspace";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
