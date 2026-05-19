import { filenameToDisplayName } from "@/lib/scoring/recruiter-card";
import { extractNameFromRawResume } from "./parse-resume-structure";

const COMPANY_WORD =
  /^(?:microsoft|google|amazon|meta|apple|netflix|flipkart|swiggy|zomato|razorpay|phonepe|paytm|freshworks|infosys|tcs|wipro|cognizant|hcl|accenture|capgemini|deloitte|ibm|oracle|sap|adobe|salesforce|uber|airbnb|stripe|linkedin|naukri|hirist|apna|shine)$/i;

const GENERIC_DISPLAY_NAMES = new Set([
  "candidate",
  "profile",
  "resume",
  "cv",
  "document",
  "file",
  "upload",
  "test",
  "sample",
  "demo",
  "unknown",
  "profile summary",
  "professional summary",
  "summary",
  "about",
  "about me",
  "curriculum vitae",
  "unknown candidate",
]);

const SECTION_NAME_PHRASE =
  /\b(?:profile\s+summary|professional\s+summary|work\s+experience|technical\s+skills|personal\s+details|career\s+objective)\b/i;

const BAD_NAME_PATTERNS =
  /^(?:candidate|profile|resume|cv|document|file|upload|test|sample|demo|mid-level engineer|not stated|unknown)$/i;

function replaceGenericDisplayName(name: string): string {
  const cleaned = cleanDisplayName(name);
  if (GENERIC_DISPLAY_NAMES.has(cleaned.toLowerCase())) {
    return "Unknown Candidate";
  }
  return cleaned;
}

/** Job-title tokens sometimes glued to filenames or header names (stripped after 2+ name words). */
const TRAILING_TITLE_WORD =
  /^(?:Principal|Senior|Junior|Lead|Staff|Engineer|Developer|Analyst|Manager|Director|Head|VP|Architect|Consultant|Associate|Executive)$/i;

export function stripTrailingJobTitleWords(words: string[]): string[] {
  const result = [...words];
  while (result.length > 2 && TRAILING_TITLE_WORD.test(result[result.length - 1] ?? "")) {
    result.pop();
  }
  return result;
}

const INDIAN_SURNAME_SUFFIXES = [
  "kumar",
  "singh",
  "reddy",
  "sharma",
  "patel",
  "gupta",
  "verma",
  "rai",
  "naidu",
  "iyer",
  "nair",
  "menon",
  "pillai",
  "joshi",
  "agarwal",
  "aggarwal",
  "banerjee",
  "chatterjee",
  "mukherjee",
  "desai",
  "mehta",
  "shah",
  "kapoor",
  "malhotra",
  "chopra",
  "saxena",
  "tiwari",
  "pandey",
  "mishra",
  "yadav",
  "thakur",
  "chauhan",
  "rathore",
  "gowda",
  "shetty",
  "rao",
  "krishnan",
  "subramanian",
  "venkatesh",
  "prasad",
];

function capitalizeWord(w: string): string {
  if (!w) return w;
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

export function splitCamelCaseToken(word: string): string[] | null {
  const parts = word
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return parts.map(capitalizeWord);
  }
  return null;
}

export function splitCompoundSurname(word: string): string[] | null {
  const lower = word.toLowerCase();
  for (const suffix of INDIAN_SURNAME_SUFFIXES) {
    if (!lower.endsWith(suffix) || lower.length <= suffix.length + 2) continue;
    const first = word.slice(0, -suffix.length);
    if (first.length >= 2) {
      return [capitalizeWord(first), capitalizeWord(suffix)];
    }
  }
  return null;
}

/** Normalize recruiter-facing names: strip employers, split glued tokens. */
export function cleanDisplayName(name: string): string {
  let words = name
    .trim()
    .replace(/[.,;:!?]+$/g, "")
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(capitalizeWord);

  while (words.length > 1 && COMPANY_WORD.test(words[words.length - 1] ?? "")) {
    words.pop();
  }

  words = stripTrailingJobTitleWords(words);

  if (words.length === 1) {
    const camel = splitCamelCaseToken(words[0]);
    if (camel) return camel.join(" ");
    const compound = splitCompoundSurname(words[0]);
    if (compound) return compound.join(" ");
  }

  return words.join(" ").trim();
}

/** Strip filename digits, glued lowercase tokens, and over-long names for display. */
export function sanitizeDisplayNameArtifacts(name: string): string {
  let text = name.trim().replace(/[_-]+/g, " ");
  if (!text) return "Unknown Candidate";

  const words = text.split(/\s+/).filter(Boolean);
  const strippedWords = words.map((w) => {
    if (/\d/.test(w)) return w.replace(/\d+$/g, "").replace(/\d+/g, "");
  }).filter((w) => w && w.length > 0) as string[];
  text = (strippedWords.length > 0 ? strippedWords : words).join(" ").trim();

  if (!text) return "Unknown Candidate";

  const isAllLowerGlued =
    !/\s/.test(text) && text === text.toLowerCase() && text.length >= 4;
  if (isAllLowerGlued) {
    const camel = splitCamelCaseToken(text);
    if (camel) text = camel.join(" ");
    else {
      const compound = splitCompoundSurname(text);
      text = compound ? compound.join(" ") : capitalizeWord(text);
    }
  }

  let finalWords = text.split(/\s+/).filter(Boolean);
  if (text.length > 30 || finalWords.length > 4) {
    finalWords = finalWords.slice(0, 2);
  }

  return cleanDisplayName(finalWords.join(" ")) || "Unknown Candidate";
}

/** True when a stored/display name should not be shown to recruiters. */
export function isBadDisplayName(name: string | null | undefined): boolean {
  const raw = name?.trim() ?? "";
  const lower = raw.toLowerCase();
  if (GENERIC_DISPLAY_NAMES.has(lower)) return true;
  if (SECTION_NAME_PHRASE.test(lower)) return true;
  if (/\bresume\b/i.test(lower) && lower.split(/\s+/).length <= 4) return true;
  if (/^projects?\s+/i.test(lower)) return true;

  const n = cleanDisplayName(raw);
  if (!n || n.length < 2) return true;
  if (BAD_NAME_PATTERNS.test(n)) return true;
  if (GENERIC_DISPLAY_NAMES.has(n.toLowerCase())) return true;
  if (SECTION_NAME_PHRASE.test(n)) return true;
  if (/\[REDACTED/i.test(n)) return true;
  if (/@/.test(n) || /\d{2,}/.test(n)) return true;

  const words = n.split(/\s+/).filter(Boolean);
  if (words.length > 4) return true;
  if (words.some((w) => COMPANY_WORD.test(w))) return true;
  if (/^projects?$/i.test(words[0] ?? "")) return true;

  return false;
}

export function composeNameFromParts(
  displayName: string | null | undefined,
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string | null {
  const fromParts = [firstName, lastName]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
  if (fromParts) {
    const cleaned = cleanDisplayName(fromParts);
    if (!isBadDisplayName(cleaned)) return cleaned;
  }

  const d = displayName?.trim();
  if (d) {
    const cleaned = cleanDisplayName(d);
    if (!isBadDisplayName(cleaned)) return cleaned;
  }
  return null;
}

function acceptName(candidate: string | null | undefined): string | null {
  const raw = candidate?.trim();
  if (!raw) return null;
  const cleaned = cleanDisplayName(raw);
  if (!cleaned || isBadDisplayName(cleaned)) return null;
  return cleaned;
}

export function resolveCandidateDisplayName(
  storedColumnName: string | null | undefined,
  profileDisplayName: string | null | undefined,
  resumeText: string,
  resumeFilename: string,
  geminiParts?: { first_name?: string; last_name?: string },
): string {
  const fromGemini = composeNameFromParts(
    profileDisplayName,
    geminiParts?.first_name,
    geminiParts?.last_name,
  );
  if (fromGemini) return replaceGenericDisplayName(fromGemini);

  const fromStored = acceptName(storedColumnName);
  if (fromStored) return replaceGenericDisplayName(fromStored);

  const fromProfile = acceptName(profileDisplayName);
  if (fromProfile) return replaceGenericDisplayName(fromProfile);

  const fromResume = extractNameFromRawResume(resumeText);
  if (fromResume) {
    const cleaned = cleanDisplayName(fromResume);
    if (!isBadDisplayName(cleaned)) return replaceGenericDisplayName(cleaned);
  }

  return replaceGenericDisplayName(
    cleanDisplayName(filenameToDisplayName(resumeFilename)),
  );
}
