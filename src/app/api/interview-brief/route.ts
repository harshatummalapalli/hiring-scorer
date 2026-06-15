import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getApiKey } from "@/lib/ai/api-keys";
import { CLAUDE_MODEL } from "@/lib/ai/model-constants";
import { trackEvent } from "@/lib/analytics/track";
import { logClaudeCall } from "@/lib/observability/log-event";
import { resolveObservabilityIds } from "@/lib/observability/resolve-context";
import { sanitizeAiErrorMessage } from "@/lib/errors/sanitize-ai-error-message";
import { parseJsonFromModel } from "@/lib/ai/parse-json";
import { scoreToVerdict } from "@/lib/scoring/recruiter-card";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import type { InterviewBrief } from "@/types/score";

export const maxDuration = 60;

type InterviewBriefBody = {
  candidate_id: string;
  saved_score_id: string;
};

const INTERVIEW_BRIEF_SYSTEM = `You are a senior recruiting strategist with 18 years of enterprise technical hiring experience. You are preparing an interviewer to conduct a focused, evidence-based interview with a specific candidate.

You will receive:
1. The role brief (title, must-haves, core signals, weights, cannot-assess items)
2. The candidate's scoring summary (overall score, verdict, dimension scores with supporting quotes, must-haves check, contradictions, strengths, watch points, profile classification)

Your job is to generate a structured interview brief that helps the interviewer:
- Probe the specific gaps and watch points found in this candidate's evaluation
- Verify the specific strengths claimed
- Explore the contradictions detected
- Assess the cannot-assess items that the resume could not answer
- Calibrate answers against a concrete rubric

Rules:
- Every question MUST reference something specific from this candidate's profile. A question that could be asked of any candidate is not acceptable.
- The rubric for each question must describe what a strong vs weak answer looks like for THIS role, not generic interview rubrics.
- The hiring manager context must be honest — if the candidate has red flags, say so directly.
- If the candidate scored below 55, the brief should focus on whether there is hidden potential worth exploring, not on confirming the low score.
- If the candidate scored above 85, the brief should focus on sell-mode: what might make this candidate decline your offer, and what to emphasize about the role.

Return this exact JSON schema with no preamble:
{
  "interview_focus": "one sentence — the single most important thing to learn from this interview",
  "candidate_context": "2-3 sentences for the interviewer — who this person is, what their profile looks like, and the key tension or question mark in their candidacy",
  "questions": [
    {
      "question": "the interview question",
      "why_this_question": "one sentence — what gap, contradiction, or strength this probes",
      "probes": [
        "follow-up if they give a vague answer",
        "follow-up to go deeper"
      ],
      "rubric": {
        "exceptional": "what a 5/5 answer sounds like — specific to this role",
        "strong": "what a 4/5 answer sounds like",
        "adequate": "what a 3/5 answer sounds like",
        "weak": "what a 1-2/5 answer sounds like"
      },
      "maps_to_dimension": "skills | trajectory | domain | seniority | tenure | cannot_assess"
    }
  ],
  "red_flags_to_watch": [
    "specific behaviors or answers that should concern the interviewer"
  ],
  "sell_points": [
    "if the candidate is strong — what to emphasize about the role/company to close them"
  ],
  "post_interview_verdict_guide": {
    "hire_signal": "what pattern of answers across questions indicates hire",
    "pass_signal": "what pattern indicates pass",
    "borderline_signal": "what pattern means bring back for another round"
  }
}`;

function snapshotForBrief(
  snapshot: Record<string, unknown>,
  overallScore: number,
): Record<string, unknown> {
  const gpt = (
    snapshot.model_raw_responses as { gpt4o?: Record<string, unknown> } | undefined
  )?.gpt4o;

  return {
    ...snapshot,
    verdict:
      snapshot.verdict ??
      gpt?.verdict ??
      scoreToVerdict(overallScore),
    confidence:
      snapshot.confidence ??
      gpt?.confidence ??
      snapshot.confidence_level,
    dimension_scores: snapshot.dimension_scores ?? gpt?.dimension_scores,
    must_haves_check: snapshot.must_haves_check ?? gpt?.must_haves_check,
    contradictions: snapshot.contradictions ?? gpt?.contradictions ?? [],
    why_this_candidate:
      snapshot.why_this_candidate ?? gpt?.why_this_candidate,
    profile_classification:
      snapshot.profile_classification ?? gpt?.profile_classification,
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as InterviewBriefBody;

    if (!body.candidate_id || !body.saved_score_id) {
      return NextResponse.json(
        { error: "candidate_id and saved_score_id required." },
        { status: 400 },
      );
    }

    const { data: savedScore, error: scoreError } = await supabase
      .from("saved_scores")
      .select(
        "id, overall_score, score_snapshot, role_brief_snapshot, role_brief_id, role_brief_title, candidate_id",
      )
      .eq("id", body.saved_score_id)
      .eq("created_by", user.id)
      .maybeSingle();

    if (scoreError || !savedScore) {
      return NextResponse.json({ error: "Score not found." }, { status: 404 });
    }

    if (
      savedScore.candidate_id != null &&
      String(savedScore.candidate_id) !== body.candidate_id
    ) {
      return NextResponse.json({ error: "Score not found." }, { status: 404 });
    }

    const { data: candidate } = await supabase
      .from("candidates")
      .select("display_name, current_title, current_company")
      .eq("id", body.candidate_id)
      .eq("created_by", user.id)
      .maybeSingle();

    const snapshotRaw = savedScore.score_snapshot as Record<string, unknown> | null;
    const roleBriefSnapshot = savedScore.role_brief_snapshot as Record<
      string,
      unknown
    > | null;

    if (!snapshotRaw) {
      return NextResponse.json(
        { error: "No score snapshot available." },
        { status: 400 },
      );
    }

    const overallScore = Number(savedScore.overall_score ?? 0);
    const snapshot = snapshotForBrief(snapshotRaw, overallScore);

    const userMessage = buildInterviewBriefUserMessage({
      candidateName: candidate?.display_name ?? "Unknown",
      candidateTitle: candidate?.current_title ?? "",
      candidateCompany: candidate?.current_company ?? "",
      roleTitle: savedScore.role_brief_title ?? "Unknown role",
      overallScore,
      snapshot,
      roleBriefSnapshot,
    });

    const client = new Anthropic({
      apiKey: getApiKey("anthropic"),
    });

    const briefStart = Date.now();
    const message = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 3000,
      temperature: 0,
      system: INTERVIEW_BRIEF_SYSTEM,
      messages: [{ role: "user", content: userMessage }],
    });

    const text = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const rawRoleId =
      roleBriefSnapshot && typeof roleBriefSnapshot === "object"
        ? (roleBriefSnapshot as { id?: string }).id
        : savedScore.role_brief_id;
    const roleBriefId =
      rawRoleId != null && String(rawRoleId).trim()
        ? String(rawRoleId)
        : null;

    const parsed = parseJsonFromModel(text) as InterviewBrief;
    const brief: InterviewBrief = {
      ...parsed,
      generated_at: new Date().toISOString(),
      role_brief_id: roleBriefId ?? undefined,
    };

    const { error: saveError } = await supabase
      .from("saved_scores")
      .update({ interview_brief: brief })
      .eq("id", body.saved_score_id)
      .eq("created_by", user.id);

    if (saveError) {
      console.error("[interview-brief] save failed:", saveError.message);
    }

    void trackEvent("interview_brief_generated", {
      candidate_id: body.candidate_id,
      job_id: roleBriefId,
      saved_score_id: body.saved_score_id,
    });

    void (async () => {
      const obsIds = await resolveObservabilityIds(user.id);
      logClaudeCall({
        eventType: "interview_brief",
        jobId: roleBriefId ?? undefined,
        candidateId: body.candidate_id,
        durationMs: Date.now() - briefStart,
        inputTokens: message.usage?.input_tokens ?? 0,
        outputTokens: message.usage?.output_tokens ?? 0,
        cacheHit: false,
        workspaceId: obsIds.workspaceId,
        recruiterId: obsIds.recruiterId,
      });
    })();

    return NextResponse.json({ brief });
  } catch (err) {
    const msg = sanitizeAiErrorMessage(
      err instanceof Error ? err.message : "Failed to generate interview brief",
    );
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function buildInterviewBriefUserMessage(input: {
  candidateName: string;
  candidateTitle: string;
  candidateCompany: string;
  roleTitle: string;
  overallScore: number;
  snapshot: Record<string, unknown>;
  roleBriefSnapshot: Record<string, unknown> | null;
}): string {
  const {
    candidateName,
    candidateTitle,
    candidateCompany,
    roleTitle,
    overallScore,
    snapshot,
    roleBriefSnapshot,
  } = input;

  const verdict = snapshot.verdict ?? "unknown";
  const confidence = snapshot.confidence ?? "unknown";
  const dimensionScores = snapshot.dimension_scores
    ? JSON.stringify(snapshot.dimension_scores, null, 2)
    : "not available";
  const mustHaves = snapshot.must_haves_check
    ? JSON.stringify(snapshot.must_haves_check, null, 2)
    : "not available";
  const contradictions =
    Array.isArray(snapshot.contradictions) && snapshot.contradictions.length > 0
      ? snapshot.contradictions.join("\n- ")
      : "none detected";
  const whyThis = snapshot.why_this_candidate
    ? JSON.stringify(snapshot.why_this_candidate, null, 2)
    : "not available";
  const profileClass = snapshot.profile_classification
    ? JSON.stringify(snapshot.profile_classification, null, 2)
    : "not available";

  let roleContext = "";
  if (roleBriefSnapshot) {
    const rb = roleBriefSnapshot;
    roleContext = `
ROLE BRIEF:
Title: ${rb.title ?? roleTitle}
Must-haves (deal breakers): ${JSON.stringify(rb.deal_breakers ?? [])}
Core signals: ${JSON.stringify(rb.core_signals ?? [])}
Preferred signals: ${JSON.stringify(rb.preferred_signals ?? [])}
Cannot assess from resume: ${JSON.stringify(rb.cannot_assess ?? [])}
Experience required: ${rb.experience_years ?? "not specified"} years
Weights: skills=${rb.weight_skills ?? 5}, trajectory=${rb.weight_trajectory ?? 5}, domain=${rb.weight_domain ?? 5}, seniority=${rb.weight_seniority ?? 5}, tenure=${rb.weight_tenure ?? 5}
`;
  }

  return `
CANDIDATE: ${candidateName}
Current: ${candidateTitle} at ${candidateCompany}
Overall score: ${overallScore}/100
Verdict: ${verdict}
Confidence: ${confidence}

${roleContext}

SCORING SUMMARY:

Dimension scores:
${dimensionScores}

Must-haves check:
${mustHaves}

Contradictions:
- ${contradictions}

Why this candidate:
${whyThis}

Profile classification:
${profileClass}

Generate 6 interview questions with rubrics targeting this candidate's specific profile. At least 2 questions must probe watch points or contradictions. At least 1 question must address a cannot-assess item from the role brief. If the candidate is a Strong or Exceptional match, include 1 sell-focused question.
`.trim();
}
