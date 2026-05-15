import { NextResponse } from "next/server";
import { insertSavedScore } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { id } = await insertSavedScore(payload as Record<string, unknown>);
    return NextResponse.json({ id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save score";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
