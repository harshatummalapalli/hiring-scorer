import { NextResponse } from "next/server";
import { analyseResumeSignals } from "@/lib/intelligence/beyond-keywords";
import { scoreCandidate } from "@/lib/ai/gpt-mini-scorer";
import type { BeyondKeywordSignals } from "@/lib/intelligence/beyond-keywords";
import { filenameToDisplayName } from "@/lib/scoring/recruiter-card";
import { stripPII } from "@/lib/resume/strip-pii";
import { buildScoringRunPayloadFromResult } from "@/lib/scoring/build-scoring-run-payload";
import { insertScoringRun } from "@/lib/supabase/server";
import type { RoleBrief } from "@/types/role-brief";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";

export const maxDuration = 120;

type ScoreRequestBody = {
  resumeText: string;
  roleBrief: RoleBrief;
  candidateFilename?: string;
};

function signalsFromResumeText(resumeText: string): BeyondKeywordSignals {
  const rq = analyseResumeSignals(resumeText);
  return {
    ...rq,
    skills_verified: [],
    skills_listed_only: [],
    ownership_ratio_percent: rq.ownership.ratio_percent,
    quantification_ratio_percent: rq.quantification.ratio_percent,
    profile_depth: rq.keyword_stuffing.flagged ? "Surface" : "Moderate",
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

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

    const candidateFilename =
      body.candidateFilename?.trim() || "unknown-candidate.pdf";

    const { stripped } = stripPII(body.resumeText.trim());
    const scoringText = stripped.trim();
    if (!scoringText) {
      return NextResponse.json(
        { error: "Resume text is empty after PII stripping." },
        { status: 400 },
      );
    }
    const signals = signalsFromResumeText(scoringText);

    const result = await scoreCandidate(scoringText, body.roleBrief, signals);
    result.recruiter_card.candidate_header.display_name =
      filenameToDisplayName(candidateFilename);

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
      message.includes("OPENAI_API_KEY") || message.includes("401")
        ? 401
        : message.includes("Supabase")
          ? 503
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
