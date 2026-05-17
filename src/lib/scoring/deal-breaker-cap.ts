import type { RoleBrief } from "@/types/role-brief";
import { matchSingleSkill } from "@/lib/intelligence/semantic-matcher";
import type { CandidateScoreResult } from "@/types/score";

function equivalentsForDealBreaker(
  roleBrief: RoleBrief,
  skill: string,
): string[] {
  const key = skill.trim().toLowerCase();
  const fromCluster = roleBrief.semantic_clusters?.[skill.trim()] ?? [];
  const fromCore = roleBrief.core_signals?.find(
    (s) => s.skill.trim().toLowerCase() === key,
  );
  const set = new Set<string>();
  for (const eq of fromCluster) {
    const t = eq.trim();
    if (t && t.toLowerCase() !== key) set.add(t);
  }
  for (const eq of fromCore?.equivalents ?? []) {
    const t = eq.trim();
    if (t && t.toLowerCase() !== key) set.add(t);
  }
  return Array.from(set);
}

/** Deal breakers from the role brief that are absent in resume text. */
export function findMissingDealBreakers(
  roleBrief: RoleBrief,
  resumeText: string,
): string[] {
  const breakers = roleBrief.deal_breakers ?? [];
  if (breakers.length === 0 || !resumeText.trim()) return [];

  const missing: string[] = [];
  for (const raw of breakers) {
    const skill = raw.trim();
    if (!skill) continue;
    const hit = matchSingleSkill(
      skill,
      equivalentsForDealBreaker(roleBrief, skill),
      resumeText,
    );
    if (hit.match_type === "not_found") {
      missing.push(skill);
    }
  }
  return missing;
}

export type DealBreakerCapResult = {
  score: number;
  warning: string | null;
  missing: string[];
  pointsDeducted: number;
};

const PENALTY_PER_MISSING = 15;
const MIN_SCORE_FLOOR = 20;

export function applyDealBreakerCap(
  overallScore: number,
  roleBrief: RoleBrief,
  resumeText: string,
): DealBreakerCapResult {
  const missing = findMissingDealBreakers(roleBrief, resumeText);
  if (missing.length === 0) {
    return {
      score: overallScore,
      warning: null,
      missing: [],
      pointsDeducted: 0,
    };
  }

  const pointsDeducted = missing.length * PENALTY_PER_MISSING;
  const adjusted = Math.max(
    MIN_SCORE_FLOOR,
    overallScore - pointsDeducted,
  );
  const label = missing.length === 1 ? "must-have" : "must-haves";
  const warning = `${missing.length} ${label} not found — score adjusted`;

  return {
    score: adjusted,
    warning,
    missing,
    pointsDeducted,
  };
}

export function attachDealBreakerWarning(
  result: CandidateScoreResult,
  cap: DealBreakerCapResult,
): CandidateScoreResult {
  if (!cap.warning) return { ...result, deal_breaker_warning: null };
  return {
    ...result,
    overall_score: cap.score,
    deal_breaker_warning: cap.warning,
  };
}
