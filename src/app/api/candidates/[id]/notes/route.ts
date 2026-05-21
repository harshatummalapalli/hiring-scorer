import { NextResponse } from "next/server";
import { createActivity, prependActivity } from "@/lib/candidates/activity";
import {
  getCandidateById,
  insertCandidateNote,
  updateCandidate,
} from "@/lib/supabase/candidates";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      body?: string;
      jobId?: string | null;
    };
    const text = body.body?.trim();
    if (!text) {
      return NextResponse.json({ error: "Note body is required." }, { status: 400 });
    }

    const candidate = await getCandidateById(id);
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    }

    const note = await insertCandidateNote(id, text, body.jobId ?? null);
    const activity = prependActivity(
      candidate.activity,
      createActivity("note_added", "Recruiter note added"),
    );
    await updateCandidate(id, { activity });

    return NextResponse.json({ note });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add note";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
