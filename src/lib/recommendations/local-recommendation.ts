import {
  careerGrowthLabel,
  ownershipLabel,
} from "@/lib/candidates/signal-labels";
import {
  coreStrengthOverlapsRole,
  primaryRoleDomains,
} from "@/lib/intelligence/skill-domains";
import type { CandidateSignalProfile } from "@/types/candidate";
import type { RoleBrief, TitleBand } from "@/types/role-brief";

export type MustHaveSpec = {
  skill: string;
  equivalents: string[];
};

export type RecommendationCandidateInput = {
  id: string;
  display_name: string;
  signal_profile: CandidateSignalProfile;
  /** Raw resume text for keyword fallback when skill arrays are empty. */
  resume_text?: string | null;
};

export type TalentRecommendation = {
  candidateId: string;
  candidateName: string;
  yearsExperience: string;
  score: number;
  matchedSkills: string[];
  seniorityNote?: string | null;
};

const BAND_RANK: Record<TitleBand, number> = {
  Entry: 1,
  Mid: 2,
  Senior: 3,
  Staff: 4,
  Principal: 5,
};

export function titleBandRank(band: string | null | undefined): number | null {
  if (!band?.trim()) return null;
  const key = band.trim() as TitleBand;
  return BAND_RANK[key] ?? null;
}

export function seniorityGapNote(
  jobBand: TitleBand | null,
  candidateBand: string | null | undefined,
): string | null {
  const jobRank = titleBandRank(jobBand);
  const candRank = titleBandRank(candidateBand);
  if (jobRank == null || candRank == null) return null;
  const gap = candRank - jobRank;
  if (gap === -1) return "Slightly below target level";
  if (gap === 1) return "May be overqualified";
  return null;
}

export function passesSeniorityFilter(
  jobBand: TitleBand | null,
  candidateBand: string | null | undefined,
): boolean {
  const jobRank = titleBandRank(jobBand);
  const candRank = titleBandRank(candidateBand);
  if (jobRank == null || candRank == null) return true;
  const gap = Math.abs(candRank - jobRank);
  if (gap >= 2) return false;
  if (
    (jobRank <= 2 && candRank >= 4) ||
    (jobRank >= 4 && candRank <= 1)
  ) {
    return false;
  }
  return true;
}

export function profileHasSkillSignals(profile: CandidateSignalProfile): boolean {
  const verified = profile.skills_verified?.length ?? 0;
  const listed = profile.skills_listed_only?.length ?? 0;
  const hasCore =
    Boolean(profile.core_strength_primary?.trim()) ||
    Boolean(profile.core_strength_secondary?.trim());
  return verified + listed > 0 || hasCore;
}

export function passesCoreStrengthFilter(
  roleBrief: RoleBrief,
  profile: CandidateSignalProfile,
): boolean {
  const roleDomains = primaryRoleDomains(roleBrief);
  if (roleDomains.length === 0) return true;
  if (!profileHasSkillSignals(profile)) return true;
  return coreStrengthOverlapsRole(profile, roleDomains);
}

const MAX_MUST_HAVE_POINTS = 60;
const POINTS_PER_MUST_HAVE = 15;

export function buildMustHaveSpecs(roleBrief: RoleBrief): MustHaveSpec[] {
  const specs: MustHaveSpec[] = [];
  const seen = new Set<string>();

  for (const raw of roleBrief.deal_breakers ?? []) {
    const skill = raw.trim();
    if (!skill) continue;
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const equivalents = new Set<string>();
    for (const [clusterKey, cluster] of Object.entries(
      roleBrief.semantic_clusters ?? {},
    )) {
      if (clusterKey.trim().toLowerCase() === key) {
        for (const eq of cluster) {
          const t = eq.trim();
          if (t && t.toLowerCase() !== key) equivalents.add(t);
        }
      }
    }
    for (const signal of roleBrief.core_signals ?? []) {
      if (signal.skill.trim().toLowerCase() === key) {
        for (const eq of signal.equivalents ?? []) {
          const t = eq.trim();
          if (t && t.toLowerCase() !== key) equivalents.add(t);
        }
      }
    }

    specs.push({ skill, equivalents: Array.from(equivalents) });
  }

  return specs;
}

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase();
}

/** Skills from verified evidence and listed/inferred skills on the profile. */
export function buildProfileSkillHaystack(
  profile: CandidateSignalProfile,
): string {
  const parts: string[] = [];
  for (const v of profile.skills_verified ?? []) {
    if (v.skill?.trim()) parts.push(v.skill.trim());
  }
  for (const s of profile.skills_listed_only ?? []) {
    if (s?.trim()) parts.push(s.trim());
  }
  return parts.join("\n").toLowerCase();
}

export function skillTermInProfile(
  term: string,
  haystack: string,
  haystackTerms: Set<string>,
): boolean {
  const normalized = normalizeTerm(term);
  if (normalized.length < 2) return false;
  if (haystackTerms.has(normalized)) return true;
  if (haystack.includes(normalized)) return true;
  return false;
}

function buildResumeTextHaystack(resumeText: string | null | undefined): string {
  return (resumeText ?? "").toLowerCase();
}

function skillTermInHaystack(term: string, haystack: string): boolean {
  const normalized = normalizeTerm(term);
  if (normalized.length < 2) return false;
  if (haystack.includes(normalized)) return true;
  return false;
}

function buildHaystackTermSet(profile: CandidateSignalProfile): Set<string> {
  const set = new Set<string>();
  for (const v of profile.skills_verified ?? []) {
    const n = normalizeTerm(v.skill ?? "");
    if (n) set.add(n);
  }
  for (const s of profile.skills_listed_only ?? []) {
    const n = normalizeTerm(s);
    if (n) set.add(n);
  }
  return set;
}

export function matchMustHaves(
  specs: MustHaveSpec[],
  profile: CandidateSignalProfile,
  resumeText?: string | null,
): string[] {
  const haystack = buildProfileSkillHaystack(profile);
  const terms = buildHaystackTermSet(profile);
  const resumeHaystack = buildResumeTextHaystack(resumeText);
  const useResumeFallback =
    resumeHaystack.length > 0 &&
    (haystack.trim().length === 0 || terms.size === 0);
  const matched: string[] = [];

  for (const spec of specs) {
    const candidates = [spec.skill, ...spec.equivalents];
    const hitProfile = candidates.some((t) =>
      skillTermInProfile(t, haystack, terms),
    );
    const hitResume =
      useResumeFallback &&
      candidates.some((t) => skillTermInHaystack(t, resumeHaystack));
    if (hitProfile || hitResume) matched.push(spec.skill);
  }

  return matched;
}

export function parseYearsExperience(value: string | null | undefined): number {
  if (!value?.trim()) return 0;
  const cleaned = value.trim().toLowerCase();
  const range = cleaned.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)/);
  if (range) {
    return (parseFloat(range[1]) + parseFloat(range[2])) / 2;
  }
  const plus = cleaned.match(/(\d+(?:\.\d+)?)\s*\+/);
  if (plus) return parseFloat(plus[1]);
  const single = cleaned.match(/(\d+(?:\.\d+)?)/);
  return single ? parseFloat(single[1]) : 0;
}

function minYearsForBand(band: TitleBand | null): number {
  switch (band) {
    case "Principal":
      return 10;
    case "Staff":
      return 8;
    case "Senior":
      return 5;
    case "Mid":
      return 2;
    case "Entry":
      return 0;
    default:
      return 2;
  }
}

export function seniorityFitPoints(
  band: TitleBand | null,
  years: number,
): number {
  return years >= minYearsForBand(band) ? 15 : 0;
}

export function careerGrowthPoints(
  profile: CandidateSignalProfile,
): number {
  const label = careerGrowthLabel(profile.trajectory_velocity);
  if (label === "Fast") return 10;
  if (label === "Steady") return 5;
  return 0;
}

export function ownershipDrivePoints(
  profile: CandidateSignalProfile,
): number {
  const count = profile.resume_quality?.ownership?.ownership_count ?? 0;
  const label = ownershipLabel(count);
  if (label === "Strong") return 10;
  if (label === "Moderate") return 5;
  return 0;
}

export function computeLocalRecommendationScore(
  roleBrief: RoleBrief,
  profile: CandidateSignalProfile,
  mustHaveSpecs?: MustHaveSpec[],
  resumeText?: string | null,
): { score: number; matchedSkills: string[] } {
  const specs = mustHaveSpecs ?? buildMustHaveSpecs(roleBrief);
  const matchedSkills = matchMustHaves(specs, profile, resumeText);

  const mustHavePoints = Math.min(
    matchedSkills.length * POINTS_PER_MUST_HAVE,
    MAX_MUST_HAVE_POINTS,
  );

  const years = parseYearsExperience(profile.total_years_experience);
  const seniority = seniorityFitPoints(roleBrief.title_band, years);
  const growth = careerGrowthPoints(profile);
  const ownership = ownershipDrivePoints(profile);

  const score = Math.min(
    100,
    mustHavePoints + seniority + growth + ownership,
  );

  return { score, matchedSkills };
}

export function scoreAllTalentRecommendations(
  roleBrief: RoleBrief,
  candidates: RecommendationCandidateInput[],
): TalentRecommendation[] {
  const specs = buildMustHaveSpecs(roleBrief);
  const scored: TalentRecommendation[] = [];

  for (const c of candidates) {
    if (!c.signal_profile) continue;
    if (!passesCoreStrengthFilter(roleBrief, c.signal_profile)) continue;
    if (
      !passesSeniorityFilter(
        roleBrief.title_band,
        c.signal_profile.title_band,
      )
    ) {
      continue;
    }
    const { score, matchedSkills } = computeLocalRecommendationScore(
      roleBrief,
      c.signal_profile,
      specs,
      c.resume_text,
    );
    scored.push({
      candidateId: c.id,
      candidateName: c.display_name,
      yearsExperience: c.signal_profile.total_years_experience?.trim() || "—",
      score,
      matchedSkills,
      seniorityNote: seniorityGapNote(
        roleBrief.title_band,
        c.signal_profile.title_band,
      ),
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

export function rankTalentRecommendations(
  roleBrief: RoleBrief,
  candidates: RecommendationCandidateInput[],
  limit = 5,
): TalentRecommendation[] {
  return scoreAllTalentRecommendations(roleBrief, candidates).slice(0, limit);
}

export function countRecommendationsAbove(
  recommendations: TalentRecommendation[],
  threshold: number,
): number {
  return recommendations.filter((r) => r.score > threshold).length;
}
