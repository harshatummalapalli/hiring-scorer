import { formatTotalExperienceDisplay } from "@/lib/candidates/format-total-experience";
import { isSummaryLikeTitle } from "@/lib/candidates/profile-display";

const SECTION_HEADER_IN_TITLE =
  /\b(?:education|post\s*graduate|postgraduate|certification|objective|summary|profile|curriculum|vitae|resume|cv|about\s*me|professional\s*summary|projects?|equinox|environment|highlights?|expertise|competencies|b\.?tech|m\.?tech|b\.?e\b|m\.?e\b|mca\b|mba\b|bca\b|b\.?sc\b|m\.?sc\b|ph\.?d\b|pgdm\b|bachelor|master|degree|diploma|graduate|undergraduate|computer\s+science|information\s+technology)\b/i;

const BULLET_OR_HYPHEN_START = /^[\s•\-\*▪◦‣⁃]+/;

const RESUME_BULLET_VERB =
  /\b(?:implemented|developed|delivered|contributed|built|designed|managed|led|created|optimized|automated|maintained|worked|responsible|experience|environment|title|generation)\b/i;

const GARBAGE_TITLE_AT =
  /\s+at\s+(?:Contributed|Delivered|Developed|Implemented|Title|Environment|VIAPLUS|The|A)\b/i;

const PHONE_IN_SUBTITLE = /\+?\d[\d\s\-().]{8,}/;
const EMAIL_IN_SUBTITLE =
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/;
const MONTH_YEAR_IN_SUBTITLE =
  /\b(at\s+)?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}/i;

const AT_DATE_SUFFIX_RE =
  /\b(?:at|@)\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s*\d{4}/i;

const YEAR_ONLY_RE = /^\d{4}$/;

const AT_MONTH_OR_YEAR_RE =
  /\bat\s+(?:\d{4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i;

const DATE_RANGE_RE =
  /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{4}\s*[-–—]\s*(?:Present|Current|Now|\d{4})/i;

function isDateAtSuffix(atPart: string): boolean {
  const fragment = atPart.trim();
  if (!fragment) return false;
  const withAt = /^at\s+/i.test(fragment) ? fragment : `at ${fragment}`;
  return (
    AT_DATE_SUFFIX_RE.test(withAt) ||
    DATE_RANGE_RE.test(fragment) ||
    AT_MONTH_OR_YEAR_RE.test(withAt) ||
    YEAR_ONLY_RE.test(fragment)
  );
}

/** Strip PII and date-range garbage from subtitle/company lines. */
export function sanitizeSubtitle(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (PHONE_IN_SUBTITLE.test(s)) return null;
  if (EMAIL_IN_SUBTITLE.test(s)) return null;
  if (MONTH_YEAR_IN_SUBTITLE.test(s)) return null;
  if (YEAR_ONLY_RE.test(s)) return null;
  if (AT_DATE_SUFFIX_RE.test(s)) return null;
  if (AT_MONTH_OR_YEAR_RE.test(s)) return null;
  if (DATE_RANGE_RE.test(s)) return null;
  if (s.length > 80) return null;
  return s;
}

/** Reject resume section headers and bullet lines masquerading as job titles. */
export function isInvalidDisplayTitle(title: string | null | undefined): boolean {
  const t = title?.trim();
  if (!t) return true;
  if (BULLET_OR_HYPHEN_START.test(t)) return true;
  if (SECTION_HEADER_IN_TITLE.test(t)) return true;
  if (GARBAGE_TITLE_AT.test(t)) return true;
  if (YEAR_ONLY_RE.test(t)) return true;
  if (AT_DATE_SUFFIX_RE.test(t)) return true;
  if (AT_MONTH_OR_YEAR_RE.test(t)) return true;
  if (DATE_RANGE_RE.test(t)) return true;
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
    if (isDateAtSuffix(atGarbage[2])) {
      trimmed = atGarbage[1].trim();
      if (isInvalidDisplayTitle(trimmed)) return null;
    } else if (
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
  return sanitizeSubtitle(company!.trim());
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
