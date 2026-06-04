import { NextResponse } from "next/server";
import { assertSuperAdminApi } from "@/lib/admin/api-guard";
import { fetchResumeParsingStats } from "@/lib/admin/resume-parsing-stats";

export async function GET() {
  const guard = await assertSuperAdminApi();
  if (guard instanceof NextResponse) return guard;

  try {
    const stats = await fetchResumeParsingStats();
    return NextResponse.json(stats);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load resume parsing stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
