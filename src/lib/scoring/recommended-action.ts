import { scoreToVerdict } from "@/lib/scoring/recruiter-card";
import type { CandidateScoreResult } from "@/types/score";

export type RecommendedAction = "interview" | "hold" | "reject";

export type RecommendedActionResult = {
  action: RecommendedAction;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  risks: string[];
};

function normalizeConfidence(
  level: string | null | undefined,
): "high" | "medium" | "low" {
  const v = (level ?? "").toLowerCase();
  if (v === "high") return "high";
  if (v === "low") return "low";
  return "medium";
}

function absentMustHaves(result: CandidateScoreResult): string[] {
  const raw = result.model_raw_responses?.gpt4o as
    | { must_haves_check?: Array<{ requirement?: string; status?: string; confidence?: string }> }
    | undefined;
  return (raw?.must_haves_check ?? [])
    .filter(
      (m) =>
        m.status === "absent" &&
        (m.confidence === "high" || m.confidence === "medium"),
    )
    .map((m) => String(m.requirement ?? "").trim())
    .filter(Boolean);
}

function inferredMustHaves(result: CandidateScoreResult): string[] {
  const raw = result.model_raw_responses?.gpt4o as
    | { must_haves_check?: Array<{ requirement?: string; status?: string }> }
    | undefined;
  return (raw?.must_haves_check ?? [])
    .filter((m) => m.status === "inferred")
    .map((m) => String(m.requirement ?? "").trim())
    .filter(Boolean);
}

/**
 * Decision-first recommendation derived from an existing score (no extra LLM call).
 */
export function deriveRecommendedAction(
  result: CandidateScoreResult,
): RecommendedActionResult {
  const score = result.overall_score;
  const verdict = scoreToVerdict(score);
  const confidence = normalizeConfidence(
    result.confidence_level ?? result.confidence_label,
  );
  const absent = absentMustHaves(result);
  const inferred = inferredMustHaves(result);

  const reasons: string[] = [];
  const risks: string[] = [];

  const strengths = result.recruiter_card?.what_stands_out ?? [];
  for (const s of strengths.slice(0, 3)) {
    if (s.signal?.trim()) reasons.push(s.signal.trim());
  }
  if (reasons.length === 0) {
    const raw = result.model_raw_responses?.gpt4o as
      | { why_this_candidate?: { summary?: string } }
      | undefined;
    const summary = raw?.why_this_candidate?.summary?.trim();
    if (summary) reasons.push(summary);
  }

  for (const w of result.recruiter_card?.worth_exploring ?? []) {
    if (w.trim()) risks.push(w.trim());
  }
  for (const absentReq of absent) {
    risks.push(`Missing must-have: ${absentReq}`);
  }
  for (const inf of inferred.slice(0, 2)) {
    risks.push(`Must-have inferred only: ${inf}`);
  }
  if (result.deal_breaker_warning) {
    risks.push(result.deal_breaker_warning);
  }

  const isWeak =
    verdict === "WEAK MATCH" ||
    verdict === "NOT A MATCH" ||
    score < 55;
  const hasCriticalGaps = absent.length >= 2 || (absent.length >= 1 && score < 70);

  if (isWeak || hasCriticalGaps) {
    return {
      action: "reject",
      confidence,
      reasons: reasons.slice(0, 3),
      risks: risks.slice(0, 4),
    };
  }

  const isStrong =
    verdict === "EXCEPTIONAL MATCH" ||
    verdict === "STRONG MATCH" ||
    score >= 75;
  const lowConfidence = confidence === "low";
  const hasGaps = absent.length > 0 || inferred.length > 0 || risks.length > 0;

  if (isStrong && !lowConfidence && absent.length === 0) {
    return {
      action: "interview",
      confidence,
      reasons: reasons.slice(0, 3),
      risks: risks.slice(0, 3),
    };
  }

  if (isStrong && hasGaps) {
    return {
      action: "hold",
      confidence,
      reasons: reasons.slice(0, 3),
      risks: risks.slice(0, 4),
    };
  }

  if (verdict === "POTENTIAL MATCH" || (score >= 55 && score < 75)) {
    return {
      action: "hold",
      confidence,
      reasons: reasons.slice(0, 3),
      risks: risks.slice(0, 4),
    };
  }

  return {
    action: "reject",
    confidence,
    reasons: reasons.slice(0, 3),
    risks: risks.slice(0, 4),
  };
}

export const RECOMMENDED_ACTION_LABELS: Record<RecommendedAction, string> = {
  interview: "Interview",
  hold: "Hold",
  reject: "Reject",
};
