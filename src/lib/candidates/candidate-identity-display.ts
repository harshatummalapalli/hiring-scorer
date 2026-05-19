import { formatTotalExperienceDisplay } from "@/lib/candidates/format-total-experience";
import { isSummaryLikeTitle } from "@/lib/candidates/profile-display";

const SECTION_HEADER_IN_TITLE =
  /\b(?:education|post\s*graduate|postgraduate|certification|objective|summary|profile|curriculum|vitae|resume|cv|about\s*me|professional\s*summary|projects?|equinox|environment|highlights?|expertise|competencies)\b/i;

const BULLET_OR_HYPHEN_START = /^[\s•\-\*▪◦‣⁃]+/;

const RESUME_BULLET_VERB =
  /\b(?:implemented|developed|delivered|contributed|built|designed|managed|led|created|optimized|automated|maintained|worked|responsible|experience|environment|title|generation)\b/i;

const GARBAGE_TITLE_AT =
  /\s+at\s+(?:Contributed|Delivered|Developed|Implemented|Title|Environment|VIAPLUS|The|A)\b/i;

/** Reject resume section headers and bullet lines masquerading as job titles. */
export function isInvalidDisplayTitle(title: string | null | undefined): boolean {
  const t = title?.trim();
  if (!t) return true;
  if (BULLET_OR_HYPHEN_START.test(t)) return true;
  if (SECTION_HEADER_IN_TITLE.test(t)) return true;
  if (GARBAGE_TITLE_AT.test(t)) return true;
  if (RESUME_BULLET_VERB.test(t) && t.length > 35) return true;
  if (isSummaryLikeTitle(t)) return true;
  if (t.length > 72) return true;
  if ((t.match(/[.!?]/g) ?? []).length >= 2) return true;
  if (/\s+[-–—]\s+/.test(t) && t.length > 40) return true;
  return false;
}

export function isInvalidDisplayCompany(company: string | null | undefined): boolean {
  const c = company?.trim();
  if (!c) return true;
  if (isInvalidDisplayTitle(c)) return true;
  if (RESUME_BULLET_VERB.test(c)) return true;
  return false;
}

export function sanitizeDisplayTitle(
  title: string | null | undefined,
  options?: { roleBriefTitle?: string | null },
): string | null {
  if (isInvalidDisplayTitle(title)) return null;
  let trimmed = title!.trim();
  const atGarbage = trimmed.match(/^(.+?)\s+at\s+(.+)$/i);
  if (atGarbage?.[1] && atGarbage[2]) {
    if (
      isInvalidDisplayCompany(atGarbage[2]) ||
      RESUME_BULLET_VERB.test(atGarbage[2])
    ) {
      trimmed = atGarbage[1].trim();
      if (isInvalidDisplayTitle(trimmed)) return null;
    }
  }
  if (
    options?.roleBriefTitle?.trim() &&
    trimmed.toLowerCase() === options.roleBriefTitle.trim().toLowerCase()
  ) {
    return null;
  }
  return trimmed;
}

export function sanitizeDisplayCompany(
  company: string | null | undefined,
): string | null {
  if (isInvalidDisplayCompany(company)) return null;
  return company!.trim();
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
  if (!formatted || formatted === "—" || /not stated/i.test(formatted)) return null;
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
