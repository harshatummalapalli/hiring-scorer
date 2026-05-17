import { NextResponse } from "next/server";
import { generateRoleScoringPrompt } from "@/lib/role-brief/generate-scoring-prompt";
import type { RoleBriefAnalysis } from "@/types/role-brief";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      jobDescription?: string;
      analysis?: RoleBriefAnalysis;
      scoring_prompt_version?: number;
    };

    if (!body.jobDescription?.trim()) {
      return NextResponse.json(
        { error: "jobDescription is required." },
        { status: 400 },
      );
    }
    if (!body.analysis) {
      return NextResponse.json(
        { error: "analysis is required." },
        { status: 400 },
      );
    }

    const nextVersion = Math.max(1, Number(body.scoring_prompt_version ?? 0) + 1);
    const scoring_prompt = await generateRoleScoringPrompt(
      body.analysis,
      body.jobDescription,
    );

    return NextResponse.json({
      scoring_prompt,
      scoring_prompt_generated_at: new Date().toISOString(),
      scoring_prompt_version: nextVersion,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate scoring prompt";
    const status =
      message.includes("ANTHROPIC_API_KEY") || message.includes("401")
        ? 401
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
