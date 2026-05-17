import { NextResponse } from "next/server";
import { analyseJobDescriptionWithScoringPrompt } from "@/lib/role-brief/analyse-jd";
import { deriveTitleFromAnalysis } from "@/types/role-brief";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { jobDescription?: string };

    if (!body.jobDescription?.trim()) {
      return NextResponse.json(
        { error: "Job description text is required." },
        { status: 400 },
      );
    }

    const result = await analyseJobDescriptionWithScoringPrompt(
      body.jobDescription,
      1,
    );
    const title = deriveTitleFromAnalysis(
      result.analysis,
      body.jobDescription,
    );

    return NextResponse.json({
      analysis: result.analysis,
      title,
      scoring_prompt: result.scoring_prompt,
      scoring_prompt_generated_at: result.scoring_prompt_generated_at,
      scoring_prompt_version: result.scoring_prompt_version,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to analyse job description";
    const status =
      message.includes("ANTHROPIC_API_KEY") || message.includes("401")
        ? 401
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
