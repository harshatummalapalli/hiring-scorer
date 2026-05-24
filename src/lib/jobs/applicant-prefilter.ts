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

function parseExperienceYears(exp: string | null | undefined): number | null {
  if (!exp) return null;

  // Handles: "8 years", "3.5 years", "4 yr 11 mo",
  //          "2 years 3 months", "11 yr 4 mo"
  const yearMatch = exp.match(/(\d+(?:\.\d+)?)\s*(?:yr|year)/i);
  const monthMatch = exp.match(/(\d+)\s*mo/i);

  let total = 0;
  if (yearMatch) total += parseFloat(yearMatch[1]);
  if (monthMatch) total += parseInt(monthMatch[1]) / 12;

  return total > 0 ? total : null;
}

function parseTitleBandMinYears(titleBand: string | null): number | null {
  if (!titleBand) return null;
  const band = titleBand.toLowerCase();
  if (band.includes("entry") || band.includes("junior")) return 0;
  if (band.includes("mid")) return 3;
  if (band.includes("senior")) return 5;
  if (band.includes("staff")) return 8;
  if (band.includes("principal")) return 12;
  return null;
}

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
  // Experience floor check
  const candidateYears = parseExperienceYears(
    profile.total_years_experience,
  );
  const minYears = parseTitleBandMinYears(roleBrief.title_band);

  if (
    candidateYears !== null &&
    minYears !== null &&
    candidateYears < minYears - 1.5 // 1.5 year tolerance
  ) {
    return "low_relevance";
  }

  const roleBands = roleBrief.title_bands?.length
    ? roleBrief.title_bands
    : roleBrief.title_band
      ? [roleBrief.title_band]
      : [];

  const seniorityFiltered =
    roleBands.length > 0 &&
    profile.title_band &&
    roleBands.every((band) => hasSeniorityGap(profile.title_band, band));

  if (seniorityFiltered) return "low_relevance";

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
