import {
  buildMustHaveSpecs,
  matchMustHaves,
} from "@/lib/recommendations/local-recommendation";
import {
  coreStrengthOverlapsRole,
  primaryRoleDomains,
} from "@/lib/intelligence/skill-domains";
import type { CandidateSignalProfile } from "@/types/candidate";
import type { CandidateScoringStatus } from "@/types/job";
import type { RoleBrief } from "@/types/role-brief";

/**
 * Runs after signal profile is built. Routes to unlikely fit when zero must-haves
 * match and core strength does not overlap job key-requirement domains.
 */
export function classifyApplicantPrefilter(
  roleBrief: RoleBrief,
  profile: CandidateSignalProfile,
): CandidateScoringStatus {
  const mustHaveSpecs = buildMustHaveSpecs(roleBrief);
  const mustHaveMatches = matchMustHaves(mustHaveSpecs, profile);
  const roleDomains = primaryRoleDomains(roleBrief);

  if (mustHaveMatches.length > 0) return "unscored";
  if (coreStrengthOverlapsRole(profile, roleDomains)) return "unscored";

  return "low_relevance";
}
