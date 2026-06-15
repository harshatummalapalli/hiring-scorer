import { NextResponse } from "next/server";
import { assertSuperAdminApi } from "@/lib/admin/api-guard";
import { fetchOperationalCosts } from "@/lib/admin/operational-cost-queries";
import { sanitizeAiErrorMessage } from "@/lib/errors/sanitize-ai-error-message";

export async function GET() {
  const guard = await assertSuperAdminApi();
  if (guard instanceof NextResponse) return guard;

  try {
    const costs = await fetchOperationalCosts();
    return NextResponse.json(costs);
  } catch (err) {
    const message = sanitizeAiErrorMessage(
      err instanceof Error ? err.message : "Failed to load costs",
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
