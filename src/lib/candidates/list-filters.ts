import type {
  CandidateCompanyTypeFilter,
  CandidateExperienceFilter,
  CandidateListItem,
  CandidateSortOption,
  CandidateVerdictFilter,
} from "@/types/candidate";
import type { CompanyType, FitVerdict } from "@/types/score";
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
  strong: "STRONG FIT",
  possible: "POSSIBLE FIT",
  weak: "WEAK FIT",
  not_suitable: "NOT SUITABLE",
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
    case "recent":
    default:
      return copy.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }
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
    case "STRONG FIT":
      return "Strong";
    case "POSSIBLE FIT":
      return "Possible";
    case "WEAK FIT":
      return "Weak";
    default:
      return "Not suitable";
  }
}
