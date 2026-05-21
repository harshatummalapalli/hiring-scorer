// Ordered career progression. Higher = more senior.
export const SENIORITY_RANK: Record<string, number> = {
  Intern: 1,
  Entry: 2,
  Mid: 3,
  Senior: 4,
  Lead: 5,
  Staff: 6,
  Principal: 7,
  Manager: 5,
  "Senior Manager": 6,
  Director: 7,
  "Senior Director": 8,
  VP: 9,
  "C-Suite": 10,
};

export function getSeniorityRank(band: string | null | undefined): number {
  if (!band) return 0;
  return SENIORITY_RANK[band] ?? 3;
}

/**
 * Returns true if candidate is more than one full seniority level below
 * the role requirement. A gap of 1 level is acceptable (stretch role).
 */
export function hasSeniorityGap(
  candidateBand: string | null | undefined,
  roleBand: string | null | undefined,
): boolean {
  if (!candidateBand || !roleBand) return false;
  const candidateRank = getSeniorityRank(candidateBand);
  const roleRank = getSeniorityRank(roleBand);
  if (candidateRank === 0 || roleRank === 0) return false;
  return roleRank - candidateRank >= 2;
}
