import { buildProfileSkillHaystack } from "@/lib/recommendations/local-recommendation";
import {
  collectRequiredSkills,
  matchSingleSkill,
} from "@/lib/intelligence/semantic-matcher";
import { hasSeniorityGap } from "@/lib/candidates/seniority-rank";
import {
  coreStrengthOverlapsRole,
  hasNonTechnicalSignals,
  isSoftwareEngineeringRole,
  primaryRoleDomains,
} from "@/lib/intelligence/skill-domains";
import type { CandidateSignalProfile } from "@/types/candidate";
import type { CandidateScoringStatus } from "@/types/job";
import type { RoleBrief } from "@/types/role-brief";

function buildPrefilterHaystack(
  profile: CandidateSignalProfile,
  resumeText: string,
): string {
  const resume = resumeText.trim();
  const skills = buildProfileSkillHaystack(profile).trim();
  if (!resume) return skills;
  if (!skills) return resume;
  return `${resume}\n\n${skills}`;
}

/** Semantic must-have matches in resume text and/or profile skills. */
export function countPrefilterMustHaveMatches(
  roleBrief: RoleBrief,
  profile: CandidateSignalProfile,
  resumeText: string,
): number {
  const haystack = buildPrefilterHaystack(profile, resumeText);
  if (!haystack.trim()) return 0;

  const specs = collectRequiredSkills(roleBrief);
  if (specs.length === 0) {
    for (const raw of roleBrief.deal_breakers ?? []) {
      const skill = raw.trim();
      if (!skill) continue;
      const hit = matchSingleSkill(skill, [], haystack);
      if (hit.match_type !== "not_found") return 1;
    }
    return 0;
  }

  let matched = 0;
  for (const { skill, equivalents } of specs) {
    const hit = matchSingleSkill(skill, equivalents, haystack);
    if (hit.match_type !== "not_found") matched += 1;
  }
  return matched;
}

/**
 * Runs after signal profile is built. Routes to unlikely fit when zero must-haves
 * match (semantic, resume + skills) and core strength does not overlap job domains.
 */
export function classifyApplicantPrefilter(
  roleBrief: RoleBrief,
  profile: CandidateSignalProfile,
  resumeText: string,
): CandidateScoringStatus {
  if (
    roleBrief.title_band &&
    profile.title_band &&
    hasSeniorityGap(profile.title_band, roleBrief.title_band)
  ) {
    return "low_relevance";
  }

  if (
    isSoftwareEngineeringRole(roleBrief) &&
    hasNonTechnicalSignals({
      core_strength_primary: profile.core_strength_primary,
      core_strength_secondary: profile.core_strength_secondary,
      most_recent_title: profile.most_recent_title,
      current_title: profile.current_title,
    })
  ) {
    return "low_relevance";
  }

  const wordCount = resumeText.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 150) {
    return "low_relevance";
  }

  const mustHaveMatches = countPrefilterMustHaveMatches(
    roleBrief,
    profile,
    resumeText,
  );
  const roleDomains = primaryRoleDomains(roleBrief);

  if (mustHaveMatches > 0) return "unscored";
  if (coreStrengthOverlapsRole(profile, roleDomains)) return "unscored";

  return "low_relevance";
}
