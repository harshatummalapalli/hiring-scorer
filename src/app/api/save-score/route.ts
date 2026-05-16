import { NextResponse } from "next/server";
import { sanitizeSavedScorePayload } from "@/lib/saved-scores/sanitize-save-payload";
import { insertSavedScore } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const raw = (await request.json()) as Record<string, unknown>;
    const payload = sanitizeSavedScorePayload(raw);

    if (
      typeof payload.overall_score !== "number" ||
      Number.isNaN(payload.overall_score)
    ) {
      return NextResponse.json(
        { error: "Overall score is missing or invalid; cannot save." },
        { status: 400 },
      );
    }

    try {
      const { id } = await insertSavedScore(payload);
      return NextResponse.json({ id });
    } catch (firstErr) {
      const msg = firstErr instanceof Error ? firstErr.message : "";
      // FK violation: role_brief_id doesn't exist in role_briefs table
      if (msg.includes("foreign key") || msg.includes("violates") || msg.includes("role_brief")) {
        const { id } = await insertSavedScore({ ...payload, role_brief_id: null });
        return NextResponse.json({ id });
      }
      throw firstErr;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save score";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
