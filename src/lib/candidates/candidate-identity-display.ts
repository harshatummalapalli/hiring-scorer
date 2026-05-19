import { formatTotalExperienceDisplay } from "@/lib/candidates/format-total-experience";

const SECTION_HEADER_IN_TITLE =
  /\b(?:education|post\s*graduate|postgraduate|certification|objective|summary|profile|curriculum|vitae|resume|cv|about\s*me|professional\s*summary)\b/i;

const BULLET_OR_HYPHEN_START = /^[\s•\-\*▪◦‣⁃]+/;

/** Reject resume section headers and bullet lines masquerading as job titles. */
export function isInvalidDisplayTitle(title: string | null | undefined): boolean {
  const t = title?.trim();
  if (!t) return true;
  if (BULLET_OR_HYPHEN_START.test(t)) return true;
  if (SECTION_HEADER_IN_TITLE.test(t)) return true;
  if (t.length > 90) return true;
  return false;
}

export function sanitizeDisplayTitle(
  title: string | null | undefined,
  options?: { roleBriefTitle?: string | null },
): string | null {
  if (isInvalidDisplayTitle(title)) return null;
  const trimmed = title!.trim();
  if (
    options?.roleBriefTitle?.trim() &&
    trimmed.toLowerCase() === options.roleBriefTitle.trim().toLowerCase()
  ) {
    return null;
  }
  return trimmed;
}

export function formatIdentityExperienceYears(
  yearsExperience?: string | null,
  experienceYears?: number | null,
): string | null {
  if (experienceYears != null && Number.isFinite(experienceYears)) {
    const n = Math.round(experienceYears);
    return n > 0 ? `${n} yrs` : null;
  }
  const formatted = formatTotalExperienceDisplay(yearsExperience ?? null);
  if (!formatted || formatted === "—") return null;
  if (/year/i.test(formatted)) {
    return formatted.replace(/\s*years?/i, " yrs");
  }
  return `${formatted} yrs`;
}

export function topSkillsForDisplay(
  topSkills?: string[] | null,
  verified?: { skill: string }[],
  listedOnly?: string[],
  limit = 5,
): string[] {
  if (topSkills?.length) {
    return topSkills.filter(Boolean).slice(0, limit);
  }
  const fromVerified = (verified ?? []).map((s) => s.skill).filter(Boolean);
  const fromListed = listedOnly ?? [];
  return [...fromVerified, ...fromListed].slice(0, limit);
}
