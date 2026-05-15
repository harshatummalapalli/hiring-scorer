export const REDACTED = {
  EMAIL: "[REDACTED EMAIL]",
  PHONE: "[REDACTED PHONE]",
  NAME: "[REDACTED NAME]",
  URL: "[REDACTED URL]",
} as const;

export type StripPIIResult = {
  original: string;
  stripped: string;
};

const EMAIL_REGEX =
  /\b[A-Za-z0-9](?:[A-Za-z0-9._%+-]*[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}\b/gi;

/** +91 and other international / local formats */
const PHONE_PATTERNS: RegExp[] = [
  /\+91[\s.-]*[6-9]\d{9}\b/g,
  /\b(?:\+91|91)[\s.-]*[6-9]\d{9}\b/g,
  /\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,9}\b/g,
  /\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  /\b[6-9]\d{9}\b/g,
];

const URL_PATTERNS: RegExp[] = [
  /https?:\/\/[^\s<>"')\]]+/gi,
  /\bwww\.[^\s<>"')\]]+/gi,
  /\blinkedin\.com\/(?:in|pub|company)\/[\w%-./]+/gi,
  /\b(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[\w%/.\-]+/gi,
  /\b[a-z]{2,3}\.linkedin\.com\/in\/[\w-]+/gi,
];

const RESUME_HEADER_WORDS = new Set([
  "resume",
  "curriculum",
  "vitae",
  "cv",
  "profile",
  "summary",
  "objective",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
  "contact",
  "phone",
  "email",
  "address",
  "linkedin",
  "github",
  "portfolio",
  "professional",
  "work",
  "history",
  "qualifications",
  "about",
  "me",
]);

const JOB_TITLE_WORDS = new Set([
  "senior",
  "junior",
  "lead",
  "staff",
  "principal",
  "associate",
  "assistant",
  "vice",
  "president",
  "director",
  "manager",
  "engineer",
  "developer",
  "analyst",
  "consultant",
  "architect",
  "designer",
  "scientist",
  "researcher",
  "intern",
  "trainee",
  "head",
  "chief",
  "officer",
  "executive",
  "specialist",
  "coordinator",
  "administrator",
  "representative",
  "software",
  "hardware",
  "data",
  "product",
  "project",
  "business",
  "marketing",
  "sales",
  "operations",
  "human",
  "resources",
  "finance",
  "accounting",
  "legal",
  "customer",
  "success",
  "support",
  "quality",
  "assurance",
  "devops",
  "full",
  "stack",
  "front",
  "end",
  "back",
]);

function replaceAll(text: string, regex: RegExp, replacement: string): string {
  return text.replace(regex, replacement);
}

function stripEmails(text: string): string {
  return replaceAll(text, EMAIL_REGEX, REDACTED.EMAIL);
}

function stripPhones(text: string): string {
  let out = text;
  for (const pattern of PHONE_PATTERNS) {
    out = replaceAll(out, new RegExp(pattern.source, pattern.flags), REDACTED.PHONE);
  }
  return out;
}

function stripUrls(text: string): string {
  let out = text;
  for (const pattern of URL_PATTERNS) {
    out = replaceAll(out, new RegExp(pattern.source, pattern.flags), REDACTED.URL);
  }
  return out;
}

function isLikelyPersonName(candidate: string): boolean {
  const trimmed = candidate.trim();
  if (trimmed.length < 3 || trimmed.length > 60) return false;
  if (/\d|@|https?:|www\.|linkedin/i.test(trimmed)) return false;
  if (/\[REDACTED/i.test(trimmed)) return false;

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;

  const lowerWords = words.map((w) => w.toLowerCase().replace(/[.,]/g, ""));
  if (lowerWords.some((w) => RESUME_HEADER_WORDS.has(w) || JOB_TITLE_WORDS.has(w))) {
    return false;
  }

  return words.every((word) => {
    const clean = word.replace(/[.,]/g, "");
    if (clean.length < 2) return false;
    return (
      /^[A-Z][a-z]{1,}$/.test(clean) ||
      /^[A-Z]{2,}$/.test(clean) ||
      /^[A-Z]\.?$/.test(clean)
    );
  });
}

function stripNamesInFirstLines(text: string, lineCount = 10): string {
  const lines = text.split("\n");

  for (let i = 0; i < Math.min(lineCount, lines.length); i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const lower = line.toLowerCase();
    if (
      RESUME_HEADER_WORDS.has(lower.trim()) ||
      /^(phone|email|mobile|tel|address|contact)\s*:/i.test(line)
    ) {
      continue;
    }

    // Full line is a name (common resume header)
    const lineWithoutLabel = line.replace(
      /^(?:name|candidate)\s*:\s*/i,
      "",
    ).trim();

    if (isLikelyPersonName(lineWithoutLabel)) {
      lines[i] = line.replace(lineWithoutLabel, REDACTED.NAME);
      continue;
    }

    // Name at start: "Jane Doe | Engineer" or "Jane Doe - Engineer"
    lines[i] = line.replace(
      /^([A-Z][a-z]{1,30}(?:\s+[A-Z][a-z.'-]{1,30}){1,3})\s*(\||-|\u2013|\u2014|,)/,
      (match, name: string, sep: string) =>
        isLikelyPersonName(name) ? `${REDACTED.NAME}${sep}` : match,
    );

    // Standalone capitalized name sequences on the line
    lines[i] = lines[i].replace(
      /\b([A-Z][a-z]{1,30}(?:\s+[A-Z][a-z.'-]{1,30}){1,3})\b/g,
      (match) => (isLikelyPersonName(match) ? REDACTED.NAME : match),
    );
  }

  return lines.join("\n");
}

/**
 * Remove PII from resume text. Returns original + stripped (API-safe) versions.
 */
export function stripPII(text: string): StripPIIResult {
  const original = text;

  let stripped = text;
  stripped = stripEmails(stripped);
  stripped = stripPhones(stripped);
  stripped = stripUrls(stripped);
  stripped = stripNamesInFirstLines(stripped, 10);

  return { original, stripped };
}

export function previewSlice(text: string, max = 2000): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\u2026`;
}
