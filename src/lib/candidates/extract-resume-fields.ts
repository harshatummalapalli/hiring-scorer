import {
  extractCurrentTitleAndCompany,
  polishTitleAndCompany,
} from "./extract-resume-header";
import { extractResumeLinks, isValidLinkedInUrl } from "./parse-resume-links";
import {
  cleanDisplayName,
  isBadDisplayName,
} from "./resolve-display-name";

const EMAIL_PATTERN =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+/g;

const INDIAN_MOBILE_PATTERNS = [
  /\+91[\s-]?[6-9]\d{9}\b/g,
  /\b91[\s-]?[6-9]\d{9}\b/g,
  /\b[6-9]\d{9}\b/g,
  /\+\d{1,3}[\s-]?\(?\d{2,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}\b/g,
];

const GENERIC_FILENAME_WORDS = new Set([
  "candidate",
  "profile",
  "resume",
  "cv",
  "document",
  "curriculum",
  "vitae",
  "unknown",
  "linkedin",
  "naukri",
  "upload",
  "file",
]);

const SECTION_HEADERS =
  /^(?:summary|experience|education|skills|contact|work\s+history|employment|projects|certifications|references|about|career|professional|qualifications|highlights|expertise|competencies|activities|interests|languages|awards|achievements|objective|profile)$/i;

const TITLE_WORD =
  /\b(?:engineer|engineering|manager|management|director|analyst|analysis|consultant|consulting|developer|development|architect|architecture|lead|senior|sr|junior|jr|staff|principal|head|vp|vice|president|scientist|designer|design|specialist|administrator|coordinator|associate|executive|programmer|tester|intern|trainee|founder|recruiter|recruitment|partner|advisor|strategist|operations|marketing|sales|finance|human\s+resources|talent|acquisition|business|product|project|program|account|client|customer|technologist|professional|data|ml|ai|software|hardware|devops|sre|qa)\b/i;

const INDIAN_LOCATIONS = [
  "Hyderabad",
  "Bangalore",
  "Bengaluru",
  "Mumbai",
  "Delhi",
  "New Delhi",
  "Chennai",
  "Pune",
  "Kolkata",
  "Ahmedabad",
  "Noida",
  "Gurgaon",
  "Gurugram",
  "Telangana",
  "Karnataka",
  "Maharashtra",
  "Tamil Nadu",
  "Andhra Pradesh",
  "NCR",
  "Indore",
  "Jaipur",
  "Kochi",
  "Chandigarh",
  "Lucknow",
  "Bhopal",
  "Remote",
];

const INTERNATIONAL_CITIES = [
  "London",
  "Singapore",
  "Dubai",
  "Sydney",
  "Melbourne",
  "Toronto",
  "Vancouver",
  "New York",
  "San Francisco",
  "Seattle",
  "Austin",
  "Boston",
  "Chicago",
  "Berlin",
  "Amsterdam",
];

export type ExtractedCandidateFields = {
  full_name: string;
  extracted_email: string | null;
  extracted_phone: string | null;
  linkedin_url: string | null;
  location: string | null;
  current_title: string | null;
  current_company: string | null;
  experience_years: number | null;
  total_years_experience: string;
};

function resumeLines(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

function normalizePhone(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export function extractEmailFromResumeText(resumeText: string): string | null {
  const matches = resumeText.match(EMAIL_PATTERN);
  if (!matches?.length) return null;
  for (const m of matches) {
    const email = m.trim().toLowerCase();
    if (email.length < 6 || email.length > 120) continue;
    if (email.endsWith(".png") || email.endsWith(".jpg")) continue;
    return email;
  }
  return null;
}

export function extractPhoneFromResumeText(resumeText: string): string | null {
  for (const pattern of INDIAN_MOBILE_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(resumeText);
    if (match?.[0]) {
      const phone = normalizePhone(match[0]);
      if (phone.replace(/\D/g, "").length >= 10) return phone;
    }
  }
  return null;
}

export function extractLocationFromResumeText(resumeText: string): string | null {
  const text = resumeText.slice(0, 12000);

  for (const city of INDIAN_LOCATIONS) {
    const re = new RegExp(
      `\\b${city.replace(/\s+/g, "\\s+")}(?:\\s*,\\s*(?:${city}|India|[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?))?\\b`,
      "i",
    );
    const m = text.match(re);
    if (m?.[0]) return m[0].replace(/\s+/g, " ").trim();
  }

  const cityState = text.match(
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*(?:India|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/,
  );
  if (cityState?.[0]) return cityState[0].trim();

  for (const city of INTERNATIONAL_CITIES) {
    if (new RegExp(`\\b${city}\\b`, "i").test(text)) {
      const m = text.match(
        new RegExp(`\\b${city}(?:,\\s*[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)?)?\\b`, "i"),
      );
      if (m?.[0]) return m[0].trim();
    }
  }

  const usCity = text.match(
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*(?:CA|NY|TX|WA|MA|IL|GA|NC|VA|CO|AZ|FL|NJ|PA|OR|OH|MI|TN|IN|MO|MD|WI|MN|BC|ON|QC|USA|United States)\b/,
  );
  return usCity?.[0]?.trim() ?? null;
}

function isCapitalizedNameWord(word: string): boolean {
  return (
    /^[A-Z][a-z]{1,}$/.test(word) ||
    /^[A-Z]{2,}$/.test(word) ||
    /^[A-Z]'[a-z]+$/.test(word) ||
    /^[A-Z]\.?$/.test(word)
  );
}

function isNameCandidateLine(line: string): boolean {
  const t = line.split(/[|•·]/)[0]?.trim() ?? line.trim();
  if (!t || t.length > 60) return false;
  if (/\d/.test(t)) return false;
  if (/@/.test(t)) return false;
  if (/https?:\/\//i.test(t)) return false;
  if (SECTION_HEADERS.test(t.replace(/[#*_]/g, "").trim())) return false;

  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  if (!words.every((w) => /^[A-Za-z][A-Za-z'.-]*$/.test(w))) return false;
  if (!words.every(isCapitalizedNameWord)) return false;

  const lower = t.toLowerCase();
  if (TITLE_WORD.test(lower) && words.length <= 3) {
    const titleOnly =
      /^(?:senior|junior|lead|staff|principal|head)?\s*(?:recruiter|manager|engineer|analyst|consultant|developer|designer|architect|executive|coordinator|specialist|associate|partner|advisor|strategist)\s*$/i;
    if (titleOnly.test(t.trim())) return false;
  }

  return true;
}

function extractNameStrategyOne(lines: string[]): string | null {
  for (const line of lines.slice(0, 20)) {
    if (!isNameCandidateLine(line)) continue;
    const name = cleanDisplayName(line.split(/[|•·]/)[0]?.trim() ?? line);
    if (name && !isBadDisplayName(name)) return name;
  }
  return null;
}

function extractNameStrategyTwo(lines: string[]): string | null {
  for (const line of lines.slice(0, 10)) {
    const dash = line.match(/^(.+?)\s*[-–—]\s*.+$/);
    if (dash?.[1]) {
      const candidate = cleanDisplayName(dash[1].trim());
      if (candidate && !isBadDisplayName(candidate) && isNameCandidateLine(dash[1])) {
        return candidate;
      }
    }
    const pipe = line.match(/^(.+?)\s*[|]\s*.+$/);
    if (pipe?.[1]) {
      const candidate = cleanDisplayName(pipe[1].trim());
      if (candidate && !isBadDisplayName(candidate) && isNameCandidateLine(pipe[1])) {
        return candidate;
      }
    }
    const at = line.match(/^(.+?)\s+(?:at|@)\s+.+$/i);
    if (at?.[1]) {
      const candidate = cleanDisplayName(at[1].trim());
      if (candidate && !isBadDisplayName(candidate)) return candidate;
    }
  }
  return null;
}

function nameFromEmailLocal(email: string): string | null {
  const local = email.split("@")[0]?.trim();
  if (!local || local.length < 3) return null;
  const parts = local.split(/[._-]+/).filter((p) => p.length >= 2);
  if (parts.length === 0) return null;
  const name = parts
    .slice(0, 4)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ");
  if (isBadDisplayName(name)) return null;
  return name;
}

function isGenericFilenameBase(base: string): boolean {
  const words = base.toLowerCase().split(/[\s_-]+/).filter(Boolean);
  if (words.length === 0) return true;
  return words.every((w) => GENERIC_FILENAME_WORDS.has(w));
}

export function extractFullNameFromResume(
  resumeText: string,
  resumeFilename: string,
  extractedEmail: string | null,
): string {
  const lines = resumeLines(resumeText);

  const s1 = extractNameStrategyOne(lines);
  if (s1) return s1;

  const s2 = extractNameStrategyTwo(lines);
  if (s2) return s2;

  if (extractedEmail) {
    const fromEmail = nameFromEmailLocal(extractedEmail);
    if (fromEmail) return fromEmail;
  }

  const base = resumeFilename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  if (base && !isGenericFilenameBase(base)) {
    const fromFile = cleanDisplayName(base);
    if (fromFile && !isBadDisplayName(fromFile)) return fromFile;
  }

  return "Unknown Candidate";
}

function parseExperienceYears(resumeText: string): number | null {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*\+\s*years?/i,
    /(\d+(?:\.\d+)?)\s*years?\s+(?:of\s+)?experience/i,
    /experience[:\s]+(\d+(?:\.\d+)?)\s*years?/i,
    /(\d+(?:\.\d+)?)\s*yrs?/i,
  ];
  const header = resumeText.slice(0, 2500);
  for (const p of patterns) {
    const m = header.match(p);
    if (m?.[1]) {
      const n = parseFloat(m[1]);
      if (Number.isFinite(n) && n >= 0 && n <= 50) return Math.round(n * 10) / 10;
    }
  }
  return null;
}

export function extractCandidateFields(
  resumeText: string,
  resumeFilename: string,
): ExtractedCandidateFields {
  const extracted_email = extractEmailFromResumeText(resumeText);
  const extracted_phone = extractPhoneFromResumeText(resumeText);
  const { linkedin_url: linkedinFromLinks } = extractResumeLinks(resumeText);
  const linkedin_url = isValidLinkedInUrl(linkedinFromLinks)
    ? linkedinFromLinks!.trim().startsWith("http")
      ? linkedinFromLinks!.trim()
      : `https://${linkedinFromLinks!.trim()}`
    : null;

  const full_name = extractFullNameFromResume(
    resumeText,
    resumeFilename,
    extracted_email,
  );

  const { current_title, current_company } = extractCurrentTitleAndCompany(resumeText);
  const polished = polishTitleAndCompany(current_title, current_company);

  const location = extractLocationFromResumeText(resumeText);
  const experience_years = parseExperienceYears(resumeText);
  const total_years_experience =
    experience_years != null
      ? `${Math.round(experience_years)} years`
      : "Not stated";

  return {
    full_name,
    extracted_email,
    extracted_phone,
    linkedin_url,
    location,
    current_title: polished.current_title,
    current_company: polished.current_company,
    experience_years,
    total_years_experience,
  };
}

export function resolvePanelDisplayName(
  displayName: string,
  profileName: string | null | undefined,
): string {
  const col = displayName?.trim() ?? "";
  const prof = profileName?.trim() ?? "";
  if (col && col.toLowerCase() !== "unknown candidate" && !isBadDisplayName(col)) {
    return col;
  }
  if (prof && prof.toLowerCase() !== "unknown candidate" && !isBadDisplayName(prof)) {
    return prof;
  }
  if (col && !isBadDisplayName(col)) return col;
  if (prof && !isBadDisplayName(prof)) return prof;
  return "Unknown Candidate";
}

export function resolvePanelLinkedInUrl(
  rowUrl: string | null | undefined,
  profileUrl: string | null | undefined,
): string | null {
  const candidates = [rowUrl, profileUrl].filter(Boolean) as string[];
  for (const raw of candidates) {
    const url = raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`;
    if (isValidLinkedInUrl(url)) return url;
  }
  return null;
}
