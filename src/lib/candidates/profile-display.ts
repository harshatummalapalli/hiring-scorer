import type { CandidateSignalProfile, ExperienceEntry } from "@/types/candidate";
import { isBadDisplayName } from "@/lib/candidates/resolve-display-name";

const REDACTED_TOKEN =
  /\bREDACTED\b|\[(?:REDACTED\s*)?(?:EMAIL|PHONE|NAME|URL)\]/i;

const DEGREE_TITLE_PATTERN =
  /\b(?:bachelor(?:'s)?|master(?:'s)?|b\.?\s*tech\.?|b\.?\s*e\.?|m\.?\s*tech\.?|mba|ph\.?\s*d\.?|doctorate|diploma|b\.?\s*sc\.?|m\.?\s*sc\.?|associate(?:'s)?)\b/i;

export function isEducationTitle(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  return DEGREE_TITLE_PATTERN.test(t);
}

export function isSummaryLikeTitle(title: string): boolean {
  const t = title.trim();
  if (t.length > 70) return true;
  if (/\.\s+[A-Z]/.test(t)) return true;
  if (t.split(/\s+/).length > 14) return true;
  if (/\b(?:the|and|with|that|this|responsible|experience|years)\b/i.test(t) && t.length > 40) {
    return true;
  }
  return false;
}

const JOB_MODIFIER =
  /^(?:Senior|Sr|Junior|Jr|Staff|Principal|Lead|Associate|Head|VP|Chief|Director|Manager|Software|Data|ML|Backend|Frontend|Full|Cloud|DevOps|Platform|Product|QA|Mobile|iOS|Android)$/i;

const JOB_TITLE_KEYWORD =
  /\b(?:engineer|developer|architect|manager|lead|analyst|consultant|director|specialist|designer|scientist|administrator|coordinator|associate|intern|tester|qa)\b/i;

export function isValidExperienceEntry(entry: ExperienceEntry): boolean {
  const title = entry.title.trim();
  const company = entry.company.trim();
  if (!title || !company) return false;
  if (title === "Role" && company === "Company") return false;
  if (/^company$/i.test(company)) return false;
  if (/\[REDACTED/i.test(title) || /\[REDACTED/i.test(company)) return false;
  if (/\+?\d{1,4}[-.\s]?\d{6,12}/.test(title) || /@/.test(title)) return false;
  if (isEducationTitle(title)) return false;
  if (isSummaryLikeTitle(title)) return false;
  if (title.length > 90) return false;
  // Reject "FIRSTNAME LASTNAME Title" — 2+ consecutive ALL_CAPS words
  const allCapsCount = title.split(/\s+/).filter((w) => /^[A-Z]{2,}$/.test(w)).length;
  if (allCapsCount >= 2) return false;
  // Reject "Firstname Lastname Staff Engineer" — 2+ leading proper-case non-job-modifier words
  if (JOB_TITLE_KEYWORD.test(title)) {
    const words = title.split(/\s+/);
    let leadingNameCount = 0;
    for (const w of words) {
      if (/^[A-Z][a-z]+$/.test(w) && !JOB_MODIFIER.test(w)) leadingNameCount++;
      else break;
    }
    if (leadingNameCount >= 2) return false;
  }
  return true;
}

export function parseYearsNumber(yearsLabel: string): number | null {
  const m = yearsLabel.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

export function formatYearsExperience(
  profile: CandidateSignalProfile,
): string | null {
  const years = profile.total_years_experience?.trim();
  if (!years || years === "Not stated") return null;
  return years;
}

/** Secondary line on talent pool cards — silent when nothing parsed. */
export function formatListCardSubtitle(profile: CandidateSignalProfile): string {
  return formatCandidateHeadline(profile) || formatYearsExperience(profile) || "";
}

/** Job title only (profile header). */
export function formatProfileHeaderTitle(
  profile: CandidateSignalProfile,
): string {
  return getDisplayJobTitle(profile);
}

/** Location and years on one line (profile header). */
export function formatProfileHeaderMeta(
  profile: CandidateSignalProfile,
): string {
  const parts: string[] = [];
  if (profile.location?.trim()) parts.push(profile.location.trim());
  const years = formatYearsExperience(profile);
  if (years) parts.push(years);
  return parts.join(" · ");
}

export function formatProfileSubtitle(profile: CandidateSignalProfile): string {
  return formatListCardSubtitle(profile);
}

export function getDisplaySummary(profile: CandidateSignalProfile): string {
  const summary = profile.professional_summary?.trim();
  if (summary && summary.length > 10) return summary;
  const years = formatYearsExperience(profile);
  const title = getDisplayJobTitle(profile) || "software engineering";
  if (years) {
    return `${years.replace(/ years?$/i, "")} years of ${title.toLowerCase().includes("engineer") ? title.toLowerCase() : "software engineering"} experience.`;
  }
  return `Experienced professional with background in ${title.toLowerCase()}.`;
}

export function titleBandToDisplayLabel(band: string | null): string {
  switch (band) {
    case "Executive":
      return "Executive-level Engineer";
    case "Staff+":
      return "Staff Engineer";
    case "Senior":
      return "Senior Engineer";
    case "Junior":
      return "Junior Engineer";
    default:
      return "Mid-level Engineer";
  }
}

export function resolveMostRecentJobTitle(
  experience: ExperienceEntry[],
  titleBand: string | null,
): string {
  const first = experience.find((e) => isValidExperienceEntry(e));
  if (first) return first.title.trim();
  return titleBandToDisplayLabel(titleBand);
}

export function getDisplayJobTitle(profile: CandidateSignalProfile): string {
  const fromValid = profile.experience.find((e) => isValidExperienceEntry(e));
  if (fromValid) return fromValid.title.trim();

  const stored = profile.most_recent_title?.trim() ?? "";
  if (
    stored &&
    stored !== "Not stated" &&
    !isEducationTitle(stored) &&
    !isSummaryLikeTitle(stored) &&
    !/\[REDACTED/i.test(stored) &&
    stored.length <= 90
  ) {
    return stored;
  }

  return "";
}

export function getCandidateHeaderName(profile: CandidateSignalProfile): string {
  const first = profile.first_name?.trim();
  const last = profile.last_name?.trim();
  if (first && last) {
    const full = `${first} ${last}`;
    if (!isBadDisplayName(full)) return full;
  }
  if (first && !isBadDisplayName(first)) return first;
  const display = profile.display_name?.trim();
  if (display && !isBadDisplayName(display)) return display;
  return "Unknown Candidate";
}

export function formatCandidateHeadline(profile: CandidateSignalProfile): string {
  const parts: string[] = [];
  const title = getDisplayJobTitle(profile);
  if (title) parts.push(title);
  if (profile.current_company?.trim()) parts.push(profile.current_company.trim());
  const years = formatYearsExperience(profile);
  if (years) parts.push(years);
  return parts.join(" · ");
}

export function evidenceContainsRedaction(text: string): boolean {
  return REDACTED_TOKEN.test(text);
}

export function paraphraseSignalEvidence(signal: string): string {
  const s = signal.toLowerCase();
  if (s.includes("ownership")) {
    return "First-person ownership language found in recent role descriptions.";
  }
  if (s.includes("quantif")) {
    return "Measurable outcomes described in work history bullets.";
  }
  if (s.includes("professional background") || s.includes("relevant")) {
    return "Relevant experience aligns with typical requirements for this profile.";
  }
  return "Supporting language identified in the candidate's work history.";
}

export function sanitizeEvidenceForDisplay(
  signal: string,
  evidence: string,
): string {
  if (!evidence?.trim() || evidenceContainsRedaction(evidence)) {
    return paraphraseSignalEvidence(signal);
  }
  return evidence.trim();
}

export function inferTitleBand(titleOrSummary: string): string | null {
  const t = titleOrSummary.toLowerCase();
  if (/\b(?:chief|cto|ceo|vp|vice president|director)\b/.test(t))
    return "Executive";
  if (/\b(?:principal|staff|distinguished)\b/.test(t)) return "Staff+";
  if (/\b(?:senior|sr\.?|lead|manager)\b/.test(t)) return "Senior";
  if (/\b(?:junior|jr\.?|associate|intern)\b/.test(t)) return "Junior";
  return "Mid";
}
