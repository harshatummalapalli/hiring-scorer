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

export function isScoredForRole(
  candidate: CandidateListItem,
  roleBriefId: string | null,
): boolean {
  return getScoreForRole(candidate, roleBriefId) != null;
}
