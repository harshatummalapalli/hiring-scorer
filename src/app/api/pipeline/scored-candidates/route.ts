import { NextResponse } from "next/server";
import { listScoredCandidatesForRole } from "@/lib/supabase/pipeline";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roleBriefId = searchParams.get("role_brief_id");
    if (!roleBriefId) {
      return NextResponse.json(
        { error: "role_brief_id is required." },
        { status: 400 },
      );
    }
    const candidates = await listScoredCandidatesForRole(roleBriefId);
    return NextResponse.json({ candidates });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list scored candidates";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
