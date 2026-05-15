import { NextResponse } from "next/server";
import { runConsensusScore } from "@/lib/ai/consensus-engine";
import { buildScoringRunPayloadFromResult } from "@/lib/scoring/build-scoring-run-payload";
import { insertScoringRun } from "@/lib/supabase/server";
import type { RoleBrief } from "@/types/role-brief";

export const maxDuration = 120;

type ScoreRequestBody = {
  resumeText: string;
  roleBrief: RoleBrief;
  candidateFilename?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ScoreRequestBody;

    if (!body.resumeText?.trim()) {
      return NextResponse.json(
        { error: "Resume text is required." },
        { status: 400 },
      );
    }

    if (!body.roleBrief?.id || !body.roleBrief?.title) {
      return NextResponse.json(
        { error: "A valid role brief is required." },
        { status: 400 },
      );
    }

    if (body.resumeText.trim().length > 50000) {
      return NextResponse.json(
        { error: "Resume text exceeds 50,000 character limit." },
        { status: 400 },
      );
    }

    console.log("[score] scoring request", {
      role: body.roleBrief.title,
      textLength: body.resumeText.trim().length,
    });

    const candidateFilename =
      body.candidateFilename?.trim() || "unknown-candidate.pdf";

    const result = await runConsensusScore(
      body.roleBrief,
      body.resumeText.trim(),
    );

    const scoringRun = buildScoringRunPayloadFromResult(
      candidateFilename,
      result,
    );

    const { id: scoringRunId } = await insertScoringRun(
      scoringRun as unknown as Record<string, unknown>,
    );

    return NextResponse.json({ result, scoringRunId });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to score candidate";
    const status =
      message.includes("Invalid API key") ||
      message.includes("401") ||
      message.includes("ANTHROPIC_API_KEY") ||
      message.includes("OPENAI_API_KEY") ||
      message.includes("GOOGLE_API_KEY")
        ? 401
        : message.includes("Supabase")
          ? 503
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
