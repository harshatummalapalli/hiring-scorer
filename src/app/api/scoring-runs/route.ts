import { NextResponse } from "next/server";
import { buildManualScoringRunPayload } from "@/lib/scoring/build-scoring-run-payload";
import { normalizeProviderLabel } from "@/lib/scoring/provider-labels";
import { insertScoringRun, listScoringRuns } from "@/lib/supabase/server";
import type { ScoringRunInsert } from "@/types/scoring-run";

export async function GET() {
  try {
    const rows = await listScoringRuns();
    return NextResponse.json({ runs: rows });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load scoring runs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type ManualBody = {
  candidate_filename: string;
  scenario_label: string;
  model_extractor: string;
  model_advocate: string;
  model_scorer: string;
  overall_score: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ManualBody;

    if (!body.candidate_filename?.trim()) {
      return NextResponse.json(
        { error: "Candidate name is required." },
        { status: 400 },
      );
    }
    if (!body.scenario_label?.trim()) {
      return NextResponse.json(
        { error: "Scenario label is required." },
        { status: 400 },
      );
    }
    if (
      !body.model_extractor ||
      !body.model_advocate ||
      !body.model_scorer
    ) {
      return NextResponse.json(
        { error: "All three model role assignments are required." },
        { status: 400 },
      );
    }
    if (
      typeof body.overall_score !== "number" ||
      Number.isNaN(body.overall_score)
    ) {
      return NextResponse.json(
        { error: "Overall score must be a number." },
        { status: 400 },
      );
    }

    const payload: ScoringRunInsert = buildManualScoringRunPayload({
      candidate_filename: body.candidate_filename,
      scenario_label: body.scenario_label,
      model_extractor: normalizeProviderLabel(body.model_extractor),
      model_advocate: normalizeProviderLabel(body.model_advocate),
      model_scorer: normalizeProviderLabel(body.model_scorer),
      overall_score: body.overall_score,
    });

    const { id } = await insertScoringRun(
      payload as unknown as Record<string, unknown>,
    );

    return NextResponse.json({ id, run: payload });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to save scoring run";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
