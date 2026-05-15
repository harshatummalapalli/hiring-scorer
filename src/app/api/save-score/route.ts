import { NextResponse } from "next/server";
import { insertSavedScore } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;

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
