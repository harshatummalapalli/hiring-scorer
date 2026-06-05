import { NextResponse } from "next/server";
import { assertSuperAdminApi } from "@/lib/admin/api-guard";
import { fetchSystemHealth } from "@/lib/admin/system-health";

export async function GET() {
  const guard = await assertSuperAdminApi();
  if (guard instanceof NextResponse) return guard;

  try {
    const health = await fetchSystemHealth();
    return NextResponse.json(health);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load system health";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
