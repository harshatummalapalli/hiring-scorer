import {
  buildMustHaveSpecs,
  matchMustHaves,
  type MustHaveSpec,
} from "@/lib/recommendations/local-recommendation";
import type { CandidateSignalProfile } from "@/types/candidate";
import type { CandidateScoringStatus } from "@/types/job";
import type { RoleBrief } from "@/types/role-brief";

function buildCoreSignalSpecs(roleBrief: RoleBrief): MustHaveSpec[] {
  return roleBrief.core_signals.map((s) => ({
    skill: s.skill,
    equivalents: s.equivalents ?? [],
  }));
}

/**
 * Local pre-filter when a resume is uploaded to a job.
 * Unlikely fit: zero must-have matches, or fewer than one must-have and two key requirements.
 */
export function classifyApplicantPrefilter(
  roleBrief: RoleBrief,
  profile: CandidateSignalProfile,
): CandidateScoringStatus {
  const mustHaveSpecs = buildMustHaveSpecs(roleBrief);
  const mustHaveMatches = matchMustHaves(mustHaveSpecs, profile);

  if (mustHaveSpecs.length > 0 && mustHaveMatches.length === 0) {
    return "low_relevance";
  }

  const coreMatches = matchMustHaves(buildCoreSignalSpecs(roleBrief), profile);

  if (mustHaveMatches.length >= 1) return "unscored";
  if (coreMatches.length >= 2) return "unscored";

  return "low_relevance";
}
