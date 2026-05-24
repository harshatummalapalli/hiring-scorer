import { NextResponse } from "next/server";
import { logWorkspaceActivityIfAuthed } from "@/lib/activity/log";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { insertSavedScoreWithFallback } from "@/lib/saved-scores/insert-with-fallback";
import { sanitizeSavedScorePayload } from "@/lib/saved-scores/sanitize-save-payload";

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

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

    const { id } = await insertSavedScoreWithFallback(payload);
    await logWorkspaceActivityIfAuthed({
      action: "save_score",
      resourceType: "saved_score",
      resourceId: id,
    });
    return NextResponse.json({ id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save score";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
