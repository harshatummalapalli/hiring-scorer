import {
  domainIdFromLabel,
  type SkillDomainId,
} from "@/lib/intelligence/skill-domains";
import type {
  CandidateCompanyTypeFilter,
  CandidateCoreStrengthFilter,
  CandidateExperienceFilter,
  CandidateListItem,
  CandidateSortOption,
  CandidateSourceFilter,
  CandidateVerdictFilter,
} from "@/types/candidate";
import type { CompanyType, FitVerdict } from "@/types/score";
import { isUnlikelyFitStatus } from "@/types/job";
import { getScoreForRole } from "./active-role-score";
import { getDisplayJobTitle } from "./profile-display";

export function parseYearsFromLabel(label: string): number | null {
  const m = label.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function matchesExperienceFilter(
  yearsLabel: string,
  filter: CandidateExperienceFilter,
): boolean {
  if (filter === "all") return true;
  const years = parseYearsFromLabel(yearsLabel);
  if (years == null) return false;
  switch (filter) {
    case "0-3":
      return years <= 3;
    case "4-7":
      return years >= 4 && years <= 7;
    case "8-12":
      return years >= 8 && years <= 12;
    case "13+":
      return years >= 13;
    default:
      return true;
  }
}

export function candidateHasCompanyType(
  item: CandidateListItem,
  type: CompanyType,
): boolean {
  const profile = item.signal_profile;
  if (profile.career_types_sequence.includes(type)) return true;
  if (profile.experience[0]?.company_type === type) return true;
  return profile.career_pattern.includes(type);
}

const VERDICT_MAP: Record<
  Exclude<CandidateVerdictFilter, "all" | "unscored">,
  FitVerdict
> = {
  exceptional: "EXCEPTIONAL MATCH",
  strong: "STRONG MATCH",
  potential: "POTENTIAL MATCH",
  weak: "WEAK MATCH",
  not_a_match: "NOT A MATCH",
};

export function matchesVerdictFilter(
  item: CandidateListItem,
  filter: CandidateVerdictFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "unscored") return item.role_scores.length === 0;
  const target = VERDICT_MAP[filter];
  return item.role_scores.some((s) => s.verdict === target);
}

export function matchesVerdictFilterForRole(
  item: CandidateListItem,
  filter: CandidateVerdictFilter,
  roleBriefId: string | null,
): boolean {
  if (filter === "all") return true;
  const score = roleBriefId ? getScoreForRole(item, roleBriefId) : null;
  if (filter === "unscored") return !score;
  if (!score) return false;
  const target = VERDICT_MAP[filter];
  return score.verdict === target;
}

/** True when this job has a saved score row (regardless of scoring_status). */
export function hasEvaluatedScoreForRole(
  item: CandidateListItem,
  roleBriefId: string,
): boolean {
  return getScoreForRole(item, roleBriefId) != null;
}

/** Pending when there is no score for this job yet (includes auto-eval in flight). */
export function isPipelinePendingEvaluation(
  item: CandidateListItem,
  roleBriefId: string,
): boolean {
  if (hasEvaluatedScoreForRole(item, roleBriefId)) return false;
  const status = item.scoring_status as string;
  return (
    status === "unscored" ||
    status === "needs_scoring" ||
    status === "evaluating"
  );
}

export function pipelineVerdictForRole(
  item: CandidateListItem,
  roleBriefId: string,
): FitVerdict | null {
  return getScoreForRole(item, roleBriefId)?.verdict ?? null;
}

/** Not a match bucket: explicit verdict or pre-score unlikely flags (weak fits use weak bucket). */
export function isPipelineNotAMatch(
  item: CandidateListItem,
  roleBriefId: string,
): boolean {
  const verdict = pipelineVerdictForRole(item, roleBriefId);
  if (verdict === "WEAK MATCH") return false;
  if (verdict === "NOT A MATCH") return true;
  if (isUnlikelyFitStatus(item.scoring_status)) return true;
  return false;
}

export function matchesSearch(item: CandidateListItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = item.display_name.toLowerCase();
  const title = getDisplayJobTitle(item.signal_profile).toLowerCase();
  return name.includes(q) || title.includes(q);
}

export function sortCandidates(
  items: CandidateListItem[],
  sort: CandidateSortOption,
): CandidateListItem[] {
  const copy = [...items];
  switch (sort) {
    case "highest_score":
      return copy.sort((a, b) => {
        if (b.highest_score !== a.highest_score) {
          return b.highest_score - a.highest_score;
        }
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
    case "most_scored":
      return copy.sort((a, b) => {
        if (b.role_scores.length !== a.role_scores.length) {
          return b.role_scores.length - a.role_scores.length;
        }
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
    case "oldest":
      return copy.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    case "name_az":
      return copy.sort((a, b) =>
        a.display_name.localeCompare(b.display_name, undefined, {
          sensitivity: "base",
        }),
      );
    case "recent":
    default:
      return copy.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }
}

const CORE_FILTER_TO_DOMAIN: Record<
  Exclude<CandidateCoreStrengthFilter, "all">,
  SkillDomainId
> = {
  backend: "backend",
  frontend: "frontend",
  data_ml: "data_ml",
  devops_infra: "devops_infra",
  ai_llm: "ai_llm",
};

export function matchesCoreStrengthFilter(
  item: CandidateListItem,
  filter: CandidateCoreStrengthFilter,
): boolean {
  if (filter === "all") return true;
  const target = CORE_FILTER_TO_DOMAIN[filter];
  const profile = item.signal_profile;
  const ids = [
    domainIdFromLabel(profile.core_strength_primary),
    domainIdFromLabel(profile.core_strength_secondary),
  ].filter(Boolean);
  return ids.includes(target);
}

export function candidateHasGithub(item: CandidateListItem): boolean {
  return Boolean(item.signal_profile.github?.username);
}

export function matchesSourceFilter(
  item: CandidateListItem,
  filter: "all" | "uploaded" | "linkedin_profile" | "application",
): boolean {
  if (filter === "all") return true;
  if (filter === "application") return item.source === "application";
  if (filter === "linkedin_profile") return item.source === "linkedin_profile";
  return item.source === "uploaded";
}

export function filterCandidates(
  items: CandidateListItem[],
  opts: {
    search: string;
    verdict: CandidateVerdictFilter;
    companyType: CandidateCompanyTypeFilter;
    experience: CandidateExperienceFilter;
  },
): CandidateListItem[] {
  return items.filter(
    (item) =>
      matchesSearch(item, opts.search) &&
      matchesVerdictFilter(item, opts.verdict) &&
      (opts.companyType === "all" ||
        candidateHasCompanyType(item, opts.companyType)) &&
      matchesExperienceFilter(
        item.signal_profile.total_years_experience,
        opts.experience,
      ),
  );
}

export function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function shortVerdictLabel(verdict: FitVerdict): string {
  switch (verdict) {
    case "EXCEPTIONAL MATCH":
      return "Exceptional";
    case "STRONG MATCH":
      return "Strong";
    case "POTENTIAL MATCH":
      return "Potential";
    case "WEAK MATCH":
      return "Weak";
    default:
      return "Not a match";
  }
}
