import type { CandidateSignalProfile, ExperienceEntry } from "@/types/candidate";

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

export function isValidExperienceEntry(entry: ExperienceEntry): boolean {
  const title = entry.title.trim();
  const company = entry.company.trim();
  if (!title || !company) return false;
  if (title === "Role" && company === "Company") return false;
  if (/^company$/i.test(company)) return false;
  if (isEducationTitle(title)) return false;
  if (isSummaryLikeTitle(title)) return false;
  if (title.length > 90) return false;
  return true;
}

export function parseYearsNumber(yearsLabel: string): number | null {
  const m = yearsLabel.match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

export function formatProfileSubtitle(profile: CandidateSignalProfile): string {
  const parts: string[] = [];
  if (profile.location?.trim()) {
    parts.push(profile.location.trim());
  }
  parts.push(getDisplayJobTitle(profile));
  const n = parseYearsNumber(profile.total_years_experience);
  parts.push(n != null ? `${n} years` : "Experience not stated");
  return parts.join(" · ");
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
    stored.length <= 90
  ) {
    return stored;
  }

  return titleBandToDisplayLabel(profile.title_band);
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
