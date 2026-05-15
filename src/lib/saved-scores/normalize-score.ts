import type { CandidateScoreResult, DimensionKey } from "@/types/score";
import type { RoleBrief } from "@/types/role-brief";

const DIMENSION_KEYS: DimensionKey[] = [
  "skills",
  "trajectory",
  "domain",
  "seniority",
  "tenure",
];

/** Ensures overall consensus score is always a valid integer 0–100 for Supabase. */
export function ensureIntegerOverallScore(
  result: CandidateScoreResult,
  roleBrief?: RoleBrief,
): number {
  const raw = result.overall_score;
  if (typeof raw === "number" && !Number.isNaN(raw)) {
    return Math.max(0, Math.min(100, Math.round(raw)));
  }

  if (roleBrief && result.dimension_scores) {
    const weights = {
      skills: roleBrief.weight_skills,
      trajectory: roleBrief.weight_trajectory,
      domain: roleBrief.weight_domain,
      seniority: roleBrief.weight_seniority,
      tenure: roleBrief.weight_tenure,
    };
    let weightedSum = 0;
    let totalWeight = 0;
    for (const key of DIMENSION_KEYS) {
      const dim = result.dimension_scores[key];
      if (!dim || typeof dim.score !== "number") continue;
      weightedSum += dim.score * weights[key];
      totalWeight += weights[key];
    }
    if (totalWeight > 0) {
      return Math.max(
        0,
        Math.min(100, Math.round(weightedSum / totalWeight)),
      );
    }
  }

  return 0;
}

export function normalizeStoredOverallScore(
  value: unknown,
  dimensionScores?: Record<DimensionKey, { score?: number }> | null,
): number {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return Math.max(0, Math.min(100, Math.round(parsed)));
    }
  }
  if (dimensionScores) {
    const scores = DIMENSION_KEYS.map((k) => dimensionScores[k]?.score).filter(
      (s): s is number => typeof s === "number" && !Number.isNaN(s),
    );
    if (scores.length > 0) {
      return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    }
  }
  return 0;
}
