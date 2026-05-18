import { cleanDisplayName, isBadDisplayName } from "./resolve-display-name";
import { filenameToDisplayName } from "@/lib/scoring/recruiter-card";

const FILENAME_NOISE =
  /\b(?:resume|cv|curriculum\s*vitae|profile|final|new|updated|revised|draft|copy|latest|v\d+)\b/gi;

const SECTION_WORD =
  /\b(?:summary|experience|education|skills|profile|objective|contact|work|employment|projects|certifications|references|about|career|professional|qualifications|highlights|expertise|competencies|activities|interests|hobbies|languages|awards|achievements)\b/i;

const TITLE_KEYWORD =
  /\b(?:engineer|manager|director|analyst|consultant|developer|architect|lead|senior|junior|staff|principal|head|vp)\b/i;

const PHONE_PATTERN =
  /\+?\d{1,4}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}|\b\d{10,15}\b/;

function resumeLines(resumeText: string): string[] {
  return resumeText.split(/\r?\n/).map((l) => l.trim());
}

function capitalizeWord(w: string): string {
  if (!w) return w;
  if (w.length === 1) return w.toUpperCase();
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/** Fix 1: filename → at most two name words after extension/noise removal. */
export function displayNameFromFilename(resumeFilename: string): string {
  let base = resumeFilename.replace(/\.[^.]+$/, "");
  base = base.replace(/\[[^\]]*\]/g, " ");
  base = base.replace(/\([^)]*\)/g, " ");
  base = base.replace(/[_-]+/g, " ");
  base = base.replace(
    /\b(?:naukri|linkedin|indeed|monster|glassdoor|jobsearch|hirist|apna|shine)\b/gi,
    "",
  );
  base = base.replace(/\b\d+\s*y(?:rs?|ears?)?\b/gi, "");
  base = base.replace(
    /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/gi,
    "",
  );
  base = base.replace(/\b20\d{2}\b/g, "");
  base = base.replace(FILENAME_NOISE, " ");
  base = base.replace(/\b(?:mle|ml|be|btech|b\.tech)\b/gi, "");
  base = base.replace(/\s+/g, " ").trim();

  if (!base) return "Candidate";

  const words = base
    .split(/\s+/)
    .filter(Boolean)
    .map(capitalizeWord)
    .slice(0, 2);

  return words.join(" ").trim() || "Candidate";
}

function isCapitalizedNameWord(word: string): boolean {
  return (
    /^[A-Z][a-z]{1,}$/.test(word) ||
    /^[A-Z]{2,}$/.test(word) ||
    /^[A-Z]\.?$/.test(word)
  );
}

function isPersonNameLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 48) return false;
  if (/\d/.test(t)) return false;
  if (/@/.test(t)) return false;
  if (PHONE_PATTERN.test(t)) return false;
  if (/[|•·,;:(){}\[\]#+~!%^&*<>]/.test(t)) return false;
  if (/https?:\/\//i.test(t) || /linkedin\.com/i.test(t)) return false;
  if (SECTION_WORD.test(t)) return false;

  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  if (!words.every(isCapitalizedNameWord)) return false;
  if (TITLE_KEYWORD.test(t)) return false;

  return true;
}

function personNameScore(name: string): number {
  const cleaned = cleanDisplayName(name);
  if (!cleaned || isBadDisplayName(cleaned)) return 0;

  let score = 10;
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 2 || words.length === 3) score += 8;
  if (words.length === 4) score += 4;
  if (TITLE_KEYWORD.test(cleaned)) score -= 25;
  if (SECTION_WORD.test(cleaned)) score -= 25;
  if (/\d|@/.test(cleaned)) score -= 30;
  return score;
}

/** Fix 2: scan first 5 lines for a person-name line. */
export function extractDisplayNameFromResumeText(resumeText: string): string | null {
  const lines = resumeLines(resumeText).filter(Boolean).slice(0, 5);
  for (const line of lines) {
    if (!isPersonNameLine(line)) continue;
    return cleanDisplayName(line);
  }
  return null;
}

export function resolveDisplayNameFromResume(
  resumeText: string,
  resumeFilename: string,
): string {
  const fromFilename = cleanDisplayName(
    displayNameFromFilename(resumeFilename),
  );
  const fromResume = extractDisplayNameFromResumeText(resumeText);

  if (fromResume && !isBadDisplayName(fromResume)) {
    const resumeScore = personNameScore(fromResume);
    const filenameScore = personNameScore(fromFilename);
    if (resumeScore > filenameScore) {
      return fromResume;
    }
  }

  if (fromFilename && !isBadDisplayName(fromFilename)) {
    return fromFilename;
  }

  if (fromResume && !isBadDisplayName(fromResume)) {
    return fromResume;
  }

  return cleanDisplayName(filenameToDisplayName(resumeFilename)) || "Candidate";
}

function isSectionHeaderLine(line: string): boolean {
  const t = line.replace(/[#*_]/g, "").trim();
  if (!t) return true;
  if (SECTION_WORD.test(t) && t.split(/\s+/).length <= 4) return true;
  return false;
}

/** Fix 3: lines 2–10 (1-based) for a job-title line under 60 characters. */
export function extractCurrentTitleFromResumeText(
  resumeText: string,
): string | null {
  const lines = resumeLines(resumeText);
  const slice = lines.slice(1, 10);

  for (const line of slice) {
    const t = line.trim();
    if (!t || t.length >= 60) continue;
    if (/\[REDACTED/i.test(t)) continue;
    if (/@/.test(t) || PHONE_PATTERN.test(t)) continue;
    if (isPersonNameLine(t)) continue;
    if (isSectionHeaderLine(t)) continue;
    if (!TITLE_KEYWORD.test(t)) continue;
    return t.slice(0, 59).trim();
  }
  return null;
}

function parseCompanyFromLine(line: string): string | null {
  const t = line.trim();
  if (!t || t.length > 80) return null;

  const atMatch = t.match(/\s+@\s+(.+)$/i) ?? t.match(/\s+at\s+(.+)$/i);
  if (atMatch?.[1]) {
    const co = atMatch[1].split(/[|,]/)[0]?.trim();
    if (co && co.length >= 2 && co.length <= 60) return co;
  }

  if (isSectionHeaderLine(t)) return null;
  if (/@/.test(t) || PHONE_PATTERN.test(t)) return null;
  if (/\d{5,}/.test(t)) return null;

  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    const w = words[0] ?? "";
    if (
      /^[A-Z][A-Za-z0-9&.-]{2,}$/.test(w) &&
      !TITLE_KEYWORD.test(w) &&
      !SECTION_WORD.test(w)
    ) {
      return w;
    }
    return null;
  }
  if (words.length < 2) return null;
  if (!words.every((w) => /^[A-Z]/.test(w) || /^(?:of|and|the|&)$/i.test(w))) {
    return null;
  }
  if (TITLE_KEYWORD.test(t) && !atMatch) return null;

  return t.length <= 60 ? t : t.slice(0, 60).trim();
}

/** Fix 4: company on the next 3 lines after the title line. */
export function extractCurrentCompanyFromResumeText(
  resumeText: string,
  titleLineIndex: number | null,
): string | null {
  const lines = resumeLines(resumeText);
  if (titleLineIndex == null || titleLineIndex < 0) return null;

  for (let j = titleLineIndex + 1; j < Math.min(titleLineIndex + 4, lines.length); j++) {
    const company = parseCompanyFromLine(lines[j] ?? "");
    if (company) return company;
  }
  return null;
}

export function extractCurrentTitleAndCompany(resumeText: string): {
  current_title: string | null;
  current_company: string | null;
} {
  const lines = resumeLines(resumeText);
  let titleIndex: number | null = null;
  let current_title: string | null = null;

  for (let i = 1; i < Math.min(10, lines.length); i++) {
    const t = (lines[i] ?? "").trim();
    if (!t || t.length >= 60) continue;
    if (/@/.test(t) || PHONE_PATTERN.test(t)) continue;
    if (isPersonNameLine(t)) continue;
    if (isSectionHeaderLine(t)) continue;
    if (!TITLE_KEYWORD.test(t)) continue;

    const atSplit = t.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
    if (atSplit) {
      current_title = atSplit[1]?.trim().slice(0, 59) || null;
      const inlineCompany = atSplit[2]?.split(/[|,]/)[0]?.trim();
      if (inlineCompany && inlineCompany.length >= 2) {
        return {
          current_title,
          current_company: inlineCompany.slice(0, 60),
        };
      }
    } else {
      current_title = t.slice(0, 59).trim();
    }
    titleIndex = i;
    break;
  }

  const current_company =
    titleIndex != null
      ? extractCurrentCompanyFromResumeText(resumeText, titleIndex)
      : null;

  return { current_title, current_company };
}

export function formatTitleAtCompany(
  currentTitle: string | null | undefined,
  currentCompany: string | null | undefined,
): string | null {
  const title = currentTitle?.trim();
  const company = currentCompany?.trim();
  if (title && company) return `${title} at ${company}`;
  if (title) return title;
  if (company) return company;
  return null;
}
