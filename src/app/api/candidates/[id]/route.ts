import { NextResponse } from "next/server";
import { getCandidateById } from "@/lib/supabase/candidates";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const candidate = await getCandidateById(id);
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    }
    return NextResponse.json({ candidate });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load candidate";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
