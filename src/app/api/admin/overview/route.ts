import { NextResponse } from "next/server";
import { assertSuperAdminApi } from "@/lib/admin/api-guard";
import { fetchAdminOverview } from "@/lib/admin/queries";

export async function GET() {
  const guard = await assertSuperAdminApi();
  if (guard instanceof NextResponse) return guard;

  try {
    const overview = await fetchAdminOverview();
    return NextResponse.json(overview);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load overview";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
