/**
 * @deprecated Name and title extraction is now handled by the Python parser
 * service. This file is kept for the displayNameFromFilename utility and
 * formatTitleAtCompany only.
 */
import {
  cleanDisplayName,
  isBadDisplayName,
  splitCamelCaseToken,
  splitCompoundSurname,
} from "./resolve-display-name";

const FILENAME_NOISE =
  /\b(?:resume|cv|curriculum\s*vitae|profile|final|new|updated|revised|draft|copy|latest|v\d+)\b/gi;

const SECTION_WORD =
  /\b(?:summary|experience|education|skills|profile|objective|contact|work|employment|projects|certifications|references|about|career|professional|qualifications|highlights|expertise|competencies|activities|interests|hobbies|languages|awards|achievements)\b/i;

const TITLE_KEYWORD =
  /\b(?:engineer|engineering|manager|management|director|analyst|analysis|consultant|consulting|developer|development|architect|architecture|lead|senior|sr|junior|jr|staff|principal|head|vp|vice|president|scientist|designer|design|specialist|administrator|coordinator|associate|executive|programmer|tester|intern|trainee|founder|co[- ]?founder|cto|ceo|cfo|coo|product|data|ml|ai|software|hardware|devops|sre|qa|technologist|professional|recruiter|recruitment|partner|advisor|strategist|operations|marketing|sales|finance|human\s+resources|talent|acquisition|business|project|program|account|client|customer)\b/i;

const ORG_SUFFIX =
  /\b(?:labs?|technologies|technology|solutions|systems|software|services|inc|ltd|llc|corp|corporation|company|group|bank|studio|media|health|pay|finance|consulting)\b/i;

const PHONE_PATTERN =
  /\+?\d{1,4}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}|\b\d{10,15}\b/;

const LOCATION_HINT =
  /\b(?:india|usa|u\.?s\.?a?|uk|canada|australia|singapore|remote|hybrid|delhi|mumbai|bangalore|bengaluru|hyderabad|pune|chennai|kolkata|gurgaon|gurugram|noida|indore|jaipur|kochi|remote)\b/i;

function resumeLines(resumeText: string): string[] {
  return resumeText.split(/\r?\n/).map((l) => l.trim());
}

function capitalizeWord(w: string): string {
  if (!w) return w;
  if (w.length === 1) return w.toUpperCase();
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function stripNamePunctuation(name: string): string {
  return name
    .replace(/[.,;:!?]+$/g, "")
    .replace(/^[,;:\s]+/, "")
    .trim();
}

function splitGluedFilenameToken(base: string): string {
  const cleaned = cleanDisplayName(base);
  if (cleaned.includes(" ")) return cleaned;

  const camel = splitCamelCaseToken(base);
  if (camel && camel.length >= 2) return camel.join(" ");

  const compound = splitCompoundSurname(base);
  if (compound && compound.length >= 2) return compound.join(" ");

  return cleaned;
}

/** Filename → at most two name words after extension/noise removal. */
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
  base = base.replace(
    /\b(?:python|java|javascript|typescript|react|node|backend|frontend|fullstack|full[- ]?stack|mle|ml|be|btech|b\.tech|developer|engineer)\b/gi,
    "",
  );
  base = base.replace(/[^\w\s.']/g, " ");
  base = base.replace(/\s+/g, " ").trim();

  if (!base) return "Candidate";

  const expanded = splitGluedFilenameToken(base);
  const words = expanded
    .split(/\s+/)
    .filter(Boolean)
    .map(capitalizeWord)
    .slice(0, 2);

  return stripNamePunctuation(words.join(" ")) || "Candidate";
}

function isCapitalizedNameWord(word: string): boolean {
  return (
    /^[A-Z][a-z]{1,}$/.test(word) ||
    /^[A-Z]{2,}$/.test(word) ||
    /^[A-Z]\.?$/.test(word)
  );
}

function firstSegment(line: string): string {
  return line.split(/[|•·]/)[0]?.trim() ?? line.trim();
}

function isPersonNameLine(line: string): boolean {
  const t = firstSegment(line);
  if (!t || t.length > 52) return false;
  if (/\d/.test(t)) return false;
  if (/@/.test(t)) return false;
  if (PHONE_PATTERN.test(t)) return false;
  if (/https?:\/\//i.test(t) || /linkedin\.com/i.test(t)) return false;
  if (SECTION_WORD.test(t)) return false;
  if (TITLE_KEYWORD.test(t) && t.split(/\s+/).length > 2) return false;

  const words = t.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    const w = words[0] ?? "";
    return (
      w.length >= 3 &&
      w.length <= 22 &&
      isCapitalizedNameWord(w) &&
      !TITLE_KEYWORD.test(w)
    );
  }
  if (words.length < 2 || words.length > 4) return false;
  if (!words.every(isCapitalizedNameWord)) return false;
  if (TITLE_KEYWORD.test(t)) return false;

  return true;
}

function personNameScore(name: string): number {
  const cleaned = stripNamePunctuation(cleanDisplayName(name));
  if (!cleaned || isBadDisplayName(cleaned)) return 0;

  let score = 10;
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 2 || words.length === 3) score += 8;
  if (words.length === 1) score += 5;
  if (words.length === 4) score += 4;
  if (TITLE_KEYWORD.test(cleaned)) score -= 25;
  if (SECTION_WORD.test(cleaned)) score -= 25;
  if (/\d|@/.test(cleaned)) score -= 30;
  return score;
}

const BAD_EXACT_DISPLAY_NAMES = new Set([
  "profile summary",
  "professional summary",
  "summary",
  "about",
  "profile",
  "curriculum vitae",
  "cv",
  "resume",
  "candidate",
]);

function isSectionLikeDisplayName(name: string): boolean {
  const cleaned = stripNamePunctuation(cleanDisplayName(name));
  if (!cleaned) return true;
  const lower = cleaned.toLowerCase();
  if (BAD_EXACT_DISPLAY_NAMES.has(lower)) return true;
  if (isBadDisplayName(cleaned)) return true;
  if (SECTION_WORD.test(cleaned) && cleaned.split(/\s+/).length <= 4) {
    return true;
  }
  return false;
}

function extractEmailFromResumeText(resumeText: string): string | null {
  const match = resumeText.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+/,
  );
  return match?.[0]?.toLowerCase() ?? null;
}

function displayNameFromEmail(email: string): string | null {
  const local = email.split("@")[0]?.trim();
  if (!local || local.length < 2) return null;
  const parts = local
    .split(/[._-]+/)
    .filter((p) => p.length >= 2 && !/^\d+$/.test(p));
  if (parts.length === 0) {
    const word = capitalizeWord(local.replace(/\d+/g, ""));
    return word.length >= 2 ? word : null;
  }
  const words = parts.map(capitalizeWord).slice(0, 2);
  const joined = stripNamePunctuation(words.join(" "));
  return joined && !isSectionLikeDisplayName(joined) ? joined : null;
}

/** Deep scan lines 5–20 for a person-name line. */
function deepScanPersonName(resumeText: string): string | null {
  const lines = resumeLines(resumeText).filter(Boolean);
  for (let i = 4; i < Math.min(20, lines.length); i++) {
    const line = lines[i] ?? "";
    if (!isPersonNameLine(line)) continue;
    const name = stripNamePunctuation(cleanDisplayName(firstSegment(line)));
    if (!isSectionLikeDisplayName(name)) return name;
  }
  return null;
}

/** Scan first 15 lines for a person-name line (incl. single-word names). */
export function extractDisplayNameFromResumeText(resumeText: string): string | null {
  const lines = resumeLines(resumeText).filter(Boolean).slice(0, 15);
  for (const line of lines) {
    if (!isPersonNameLine(line)) continue;
    const name = stripNamePunctuation(cleanDisplayName(firstSegment(line)));
    if (isSectionLikeDisplayName(name)) continue;
    return name;
  }
  return null;
}

function resolveAfterBadNameFallback(
  resumeText: string,
  candidate: string,
): string {
  if (!isSectionLikeDisplayName(candidate)) return candidate;
  const deep = deepScanPersonName(resumeText);
  if (deep) return deep;
  const email = extractEmailFromResumeText(resumeText);
  if (email) {
    const fromEmail = displayNameFromEmail(email);
    if (fromEmail) return fromEmail;
  }
  return candidate;
}

export function resolveDisplayNameFromResume(
  resumeText: string,
  resumeFilename: string,
): string {
  const fromFilename = stripNamePunctuation(
    cleanDisplayName(displayNameFromFilename(resumeFilename)),
  );
  const fromResume = extractDisplayNameFromResumeText(resumeText);

  let resolved: string;

  if (fromResume && !isBadDisplayName(fromResume)) {
    const resumeScore = personNameScore(fromResume);
    const filenameScore = personNameScore(fromFilename);
    if (resumeScore >= filenameScore || filenameScore < 8) {
      resolved = fromResume;
    } else if (fromFilename && !isBadDisplayName(fromFilename)) {
      resolved = fromFilename;
    } else {
      resolved = fromResume;
    }
  } else if (fromFilename && !isBadDisplayName(fromFilename)) {
    resolved = fromFilename;
  } else if (fromResume && !isBadDisplayName(fromResume)) {
    resolved = fromResume;
  } else {
    resolved =
      stripNamePunctuation(cleanDisplayName(displayNameFromFilename(resumeFilename))) ||
      "Candidate";
  }

  return resolveAfterBadNameFallback(resumeText, resolved);
}

function isSectionHeaderLine(line: string): boolean {
  const t = line.replace(/[#*_]/g, "").trim();
  if (!t) return true;
  if (SECTION_WORD.test(t) && t.split(/\s+/).length <= 4) return true;
  return false;
}

function looksLikeLocation(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (LOCATION_HINT.test(t)) return true;
  if (/\b[A-Z][a-z]+,\s*[A-Z][a-z]{2,}\b/.test(t)) return true;
  if (/^\d{5,6}\b/.test(t)) return true;
  return false;
}

function looksLikeJobTitle(text: string): boolean {
  return TITLE_KEYWORD.test(text);
}

function companyLooksLikeTitle(title: string | null, company: string): boolean {
  const c = company.trim();
  const t = title?.trim() ?? "";
  if (!c) return true;
  if (t && c.toLowerCase() === t.toLowerCase()) return true;
  if (t && c.toLowerCase().includes(t.toLowerCase()) && c.length <= t.length + 8) {
    return true;
  }
  if (looksLikeJobTitle(c) && !ORG_SUFFIX.test(c)) {
    const words = c.split(/\s+/).filter(Boolean);
    if (words.length >= 2) return true;
  }
  return false;
}

export function polishTitleAndCompany(
  title: string | null | undefined,
  company: string | null | undefined,
): { current_title: string | null; current_company: string | null } {
  let current_title = title?.replace(/\s+/g, " ").trim() || null;
  let current_company = company?.replace(/\s+/g, " ").trim() || null;

  if (current_title && current_title.length > 72) {
    current_title = current_title.slice(0, 72).trim();
  }
  if (current_company && current_company.length > 48) {
    current_company = current_company.slice(0, 48).trim();
  }

  if (current_company && companyLooksLikeTitle(current_title, current_company)) {
    current_company = null;
  }
  if (current_company && looksLikeLocation(current_company)) {
    current_company = null;
  }

  return {
    current_title: current_title || null,
    current_company: current_company || null,
  };
}

function parsePipeHeaderLine(line: string): {
  current_title: string | null;
  current_company: string | null;
} {
  const parts = line
    .split(/[|•·]/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) {
    return { current_title: null, current_company: null };
  }

  const titleIdx = parts.findIndex(
    (p) => looksLikeJobTitle(p) && !looksLikeLocation(p) && p.length < 90,
  );
  if (titleIdx < 0) {
    return { current_title: null, current_company: null };
  }

  const rawTitle = parts[titleIdx].slice(0, 72).trim();
  for (let i = titleIdx + 1; i < parts.length; i++) {
    const seg = parts[i]?.trim() ?? "";
    if (!seg || looksLikeLocation(seg)) continue;
    if (/@|PHONE_PATTERN/.test(seg)) continue;
    if (looksLikeJobTitle(seg) && !ORG_SUFFIX.test(seg)) continue;

    return polishTitleAndCompany(rawTitle, seg);
  }

  return polishTitleAndCompany(rawTitle, null);
}

function parseAtCompanyLine(line: string): {
  current_title: string | null;
  current_company: string | null;
} | null {
  const match = line.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
  if (!match?.[1] || !match[2]) return null;

  const title = match[1].trim();
  const company = match[2].split(/[|•,]/)[0]?.trim() ?? "";
  if (!looksLikeJobTitle(title)) return null;

  return polishTitleAndCompany(title, company);
}

function parseCompanyFromLine(line: string, title: string | null): string | null {
  const t = line.trim();
  if (!t || t.length > 80) return null;

  const atMatch = t.match(/\s+@\s+(.+)$/i) ?? t.match(/\s+at\s+(.+)$/i);
  if (atMatch?.[1]) {
    const co = atMatch[1].split(/[|,•·]/)[0]?.trim();
    if (co && !companyLooksLikeTitle(title, co) && !looksLikeLocation(co)) {
      return co.slice(0, 48);
    }
  }

  if (isSectionHeaderLine(t)) return null;
  if (/@/.test(t) || PHONE_PATTERN.test(t)) return null;
  if (looksLikeLocation(t)) return null;
  if (looksLikeJobTitle(t)) return null;

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

  const candidate = t.length <= 48 ? t : t.slice(0, 48).trim();
  if (companyLooksLikeTitle(title, candidate)) return null;
  return candidate;
}

function extractCompanyAfterTitle(
  lines: string[],
  titleIndex: number,
  title: string | null,
): string | null {
  for (let j = titleIndex + 1; j < Math.min(titleIndex + 4, lines.length); j++) {
    const company = parseCompanyFromLine(lines[j] ?? "", title);
    if (company) return company;
  }
  return null;
}

/** Header scan (lines 1–12) with pipe / at / bullet patterns. */
export function extractCurrentTitleAndCompany(resumeText: string): {
  current_title: string | null;
  current_company: string | null;
} {
  const lines = resumeLines(resumeText);

  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const raw = (lines[i] ?? "").trim();
    if (!raw) continue;
    if (/@/.test(raw) || PHONE_PATTERN.test(raw)) continue;
    if (isSectionHeaderLine(raw)) continue;

    const nameProbe = firstSegment(raw);
    if (i < 3 && isPersonNameLine(nameProbe) && !looksLikeJobTitle(raw)) {
      continue;
    }

    if (/[|•·]/.test(raw) && looksLikeJobTitle(raw)) {
      const piped = parsePipeHeaderLine(raw);
      if (piped.current_title) return piped;
    }

    const atParsed = parseAtCompanyLine(raw);
    if (atParsed?.current_title) return atParsed;

    const bulletTitle = raw.match(/^([^•·|]{4,}?)(?:\s*[•·]\s*|\s+-\s+)(.+)$/);
    if (bulletTitle && looksLikeJobTitle(bulletTitle[1])) {
      const title = bulletTitle[1].trim();
      const rest = bulletTitle[2].trim();
      const restParts = rest.split(/[•·|]/).map((p) => p.trim());
      for (const part of restParts) {
        if (part && !looksLikeLocation(part) && !companyLooksLikeTitle(title, part)) {
          if (!looksLikeJobTitle(part) || ORG_SUFFIX.test(part)) {
            return polishTitleAndCompany(title, part);
          }
        }
      }
      return polishTitleAndCompany(title, null);
    }

    if (raw.length >= 60 && looksLikeJobTitle(raw)) {
      const shortened = parsePipeHeaderLine(raw.replace(/\s+-\s+/g, " | "));
      if (shortened.current_title) return shortened;
    }

    if (raw.length < 90 && looksLikeJobTitle(raw) && !isPersonNameLine(raw)) {
      const title = raw.slice(0, 72).trim();
      const company = extractCompanyAfterTitle(lines, i, title);
      return polishTitleAndCompany(title, company);
    }
  }

  return { current_title: null, current_company: null };
}

export function formatTitleAtCompany(
  currentTitle: string | null | undefined,
  currentCompany: string | null | undefined,
): string | null {
  const { current_title, current_company } = polishTitleAndCompany(
    currentTitle,
    currentCompany,
  );
  if (current_title && current_company) {
    return `${current_title} at ${current_company}`;
  }
  if (current_title) return current_title;
  if (current_company) return current_company;
  return null;
}
