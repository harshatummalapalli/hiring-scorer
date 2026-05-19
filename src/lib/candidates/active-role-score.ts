import type { CandidateListItem, CandidateScoreSummary } from "@/types/candidate";

export function getScoreForRole(
  candidate: CandidateListItem,
  roleBriefId: string | null,
): CandidateScoreSummary | null {
  if (!roleBriefId) return null;
  return (
    candidate.role_scores.find((s) => s.role_brief_id === roleBriefId) ?? null
  );
}

/** Prefer active job score when present; otherwise highest saved score. */
export function getPrimaryRoleScore(
  candidate: CandidateListItem,
  preferredRoleBriefId?: string | null,
): CandidateScoreSummary | null {
  if (candidate.role_scores.length === 0) return null;
  if (preferredRoleBriefId) {
    const match = getScoreForRole(candidate, preferredRoleBriefId);
    if (match) return match;
  }
  return [...candidate.role_scores].sort(
    (a, b) => b.overall_score - a.overall_score,
  )[0] ?? null;
}

export function isScoredForRole(
  candidate: CandidateListItem,
  roleBriefId: string | null,
): boolean {
  return getScoreForRole(candidate, roleBriefId) != null;
}
