import { NextResponse } from "next/server";
import { assertSuperAdminApi } from "@/lib/admin/api-guard";
import { fetchPlatformAnalytics } from "@/lib/admin/analytics-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await assertSuperAdminApi();
  if (guard instanceof NextResponse) return guard;

  try {
    const data = await fetchPlatformAnalytics();
    return NextResponse.json(data);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load analytics";
    const hint = message.toLowerCase().includes("does not exist")
      ? "Run supabase/analytics-events.sql in your Supabase SQL editor."
      : undefined;
    return NextResponse.json(
      { error: message, ...(hint ? { hint } : {}) },
      { status: 500 },
    );
  }
}
