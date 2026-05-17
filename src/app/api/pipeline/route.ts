import { NextResponse } from "next/server";
import { addCandidateToPipeline } from "@/lib/pipeline/add-to-pipeline";
import { getPipelineBoard } from "@/lib/supabase/pipeline";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get("role_brief_id")?.trim();
    const board = await getPipelineBoard();
    if (roleId) {
      const section = board.sections.find((s) => s.role_brief_id === roleId);
      return NextResponse.json({
        ...board,
        sections: section ? [section] : [],
      });
    }
    return NextResponse.json(board);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load pipeline";
    const hint = message.toLowerCase().includes("does not exist")
      ? "Run supabase/pipeline_candidates.sql in your Supabase SQL editor."
      : undefined;
    return NextResponse.json(
      { error: message, ...(hint ? { hint } : {}) },
      { status: message.includes("Supabase") ? 503 : 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      role_brief_id?: string;
      candidate_ids?: string[];
    };
    if (!body.role_brief_id?.trim()) {
      return NextResponse.json(
        { error: "role_brief_id is required." },
        { status: 400 },
      );
    }
    const ids = body.candidate_ids?.filter(Boolean) ?? [];
    if (ids.length === 0) {
      return NextResponse.json(
        { error: "candidate_ids is required." },
        { status: 400 },
      );
    }

    const results = [];
    for (const candidateId of ids) {
      const result = await addCandidateToPipeline(
        candidateId,
        body.role_brief_id.trim(),
      );
      results.push(result);
    }

    const board = await getPipelineBoard();
    return NextResponse.json({ results, sections: board.sections });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to add to pipeline";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
