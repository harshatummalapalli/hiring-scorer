import type { CompanyType } from "@/types/score";
import type { EducationEntry, ExperienceEntry } from "@/types/candidate";

const SECTION_HEADERS =
  /^(?:professional\s+)?(?:summary|profile|objective|about(?:\s+me)?|career\s+objective)\s*$|^(?:work\s+)?experience|employment|professional\s+experience|career\s+history|education|academic|skills|technical\s+skills|core\s+competencies$/i;

const SUMMARY_SECTION_KEYS = [
  "summary",
  "professional summary",
  "profile",
  "about",
  "about me",
  "objective",
  "career objective",
];

const MONTH =
  "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";

const DATE_RANGE =
  new RegExp(
    `(\\b${MONTH}\\.?\\s*\\d{4}|\\b\\d{1,2}\\/\\d{4}|\\b(?:19|20)\\d{2})\\s*(?:[-–—]|\\s+to\\s+)\\s*(\\b${MONTH}\\.?\\s*(?:\\d{4})?|\\b(?:Present|Current|Now)|\\b\\d{1,2}\\/\\d{4}|\\b(?:19|20)\\d{2})`,
    "i",
  );

const JOB_TITLE_HINT =
  /\b(?:engineer|developer|architect|manager|lead|analyst|consultant|director|specialist|designer|scientist|administrator|coordinator|associate|intern|tester|qa)\b/i;

const PRODUCT_HINTS =
  /\b(?:google|meta|microsoft|amazon|apple|netflix|spotify|uber|airbnb|stripe|shopify|atlassian|salesforce|adobe|linkedin|twitter|x\.com|flipkart|swiggy|zomato|razorpay|phonepe|paytm|freshworks|zendesk|hubspot|notion|figma|slack|dropbox|palantir|snowflake|databricks|openai|anthropic)\b/i;

const SERVICES_HINTS =
  /\b(?:accenture|deloitte|pwc|kpmg|ey |infosys|tcs|wipro|cognizant|capgemini|hcl|tech\s*mahindra|ltimindtree|mphasis|genpact|ibm\s+consulting|dxc|ntt\s+data)\b/i;

const GCC_HINTS =
  /\b(?:gcc|global\s+capability|offshore|shared\s+services|captives?)\b/i;

const STARTUP_HINTS =
  /\b(?:startup|series\s+[a-d]|seed\s+stage|early[- ]stage|venture[- ]backed)\b/i;

const EDUCATION_SECTION_LINE =
  /^(?:#{1,3}\s*)?(?:education|academic(?:\s+background)?|qualifications|degrees)\s*:?\s*$/i;

import { isEducationTitle, isValidExperienceEntry } from "./profile-display";

export function inferCompanyType(company: string, context = ""): CompanyType {
  const blob = `${company} ${context}`.toLowerCase();
  if (PRODUCT_HINTS.test(blob)) return "Product";
  if (GCC_HINTS.test(blob)) return "GCC";
  if (STARTUP_HINTS.test(blob)) return "Startup";
  if (SERVICES_HINTS.test(blob)) return "Services";
  if (/\b(?:labs?|technologies|software|solutions|systems)\b/i.test(company)) {
    return "Product";
  }
  return "Services";
}

function splitSections(text: string): Map<string, string[]> {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const sections = new Map<string, string[]>();
  let current = "header";
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length) sections.set(current, [...buffer]);
    buffer = [];
  };

  for (const line of lines) {
    if (!line) continue;
    const headerMatch = line.match(
      /^(?:#{1,3}\s*)?([A-Z][A-Za-z\s/&-]{2,40}):?\s*$/,
    );
    const isHeader =
      SECTION_HEADERS.test(line.replace(/[#*_]/g, "").trim()) ||
      (headerMatch &&
        SECTION_HEADERS.test(headerMatch[1].trim()) &&
        line.length < 50);

    if (isHeader) {
      flush();
      const key = line
        .replace(/[#*_]/g, "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
      if (/summary|profile|objective|about/.test(key)) current = "summary";
      else if (/experience|employment|career/.test(key)) current = "experience";
      else if (/education|academic/.test(key)) current = "education";
      else if (/skill|competenc|technolog/.test(key)) current = "skills";
      else current = key;
      continue;
    }

    buffer.push(line);
  }
  flush();
  return sections;
}

export function extractProfessionalSummary(
  resumeText: string,
  sections: Map<string, string[]>,
): string {
  for (const key of SUMMARY_SECTION_KEYS) {
    const lines = sections.get(key);
    if (lines?.length) {
      const text = lines.join(" ").replace(/\s+/g, " ").trim();
      if (text.length >= 20) return text.slice(0, 500);
    }
  }

  const lines = resumeText.split(/\r?\n/).map((l) => l.trim());
  let pastContact = false;
  let contactLines = 0;
  const paragraphs: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (!line) {
      if (current.length) {
        paragraphs.push(current.join(" "));
        current = [];
      }
      if (pastContact && paragraphs.length >= 1) break;
      continue;
    }

    const looksContact =
      /@/.test(line) ||
      /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(line) ||
      /linkedin\.com/i.test(line) ||
      /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(line) && contactLines === 0;

    if (!pastContact) {
      if (looksContact || contactLines < 4) {
        contactLines += 1;
        continue;
      }
      pastContact = true;
    }

    if (SECTION_HEADERS.test(line.replace(/[#*_]/g, "").trim())) break;
    if (line.startsWith("•") || line.startsWith("-") || line.startsWith("*"))
      break;
    if (DATE_RANGE.test(line) && current.length === 0) break;

    current.push(line);
    if (current.join(" ").length > 400) break;
  }

  if (current.length) paragraphs.push(current.join(" "));
  const first = paragraphs.find((p) => p.length > 60);
  return first?.replace(/\s+/g, " ").trim() ?? "";
}

export function extractLocation(resumeText: string): string | null {
  const header = resumeText.slice(0, 800);
  const locMatch = header.match(
    /(?:^|\n)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,\s*(?:[A-Z]{2}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:,\s*[A-Z][a-z]+)?)\s*(?:\||•|$)/m,
  );
  if (locMatch?.[1]) return locMatch[1].trim();
  const cityState = header.match(
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,\s*(?:CA|NY|TX|WA|MA|IL|GA|NC|VA|CO|AZ|FL|NJ|PA|OR|OH|MI|TN|IN|MO|MD|WI|MN|BC|ON|QC))\b/,
  );
  return cityState?.[1]?.trim() ?? null;
}

function parseBulletsFromLines(lines: string[]): string[] {
  return lines
    .filter((l) => /^[•\-\*▪]/.test(l) || /^\d+\.\s/.test(l))
    .map((l) => l.replace(/^[•\-\*▪]\s*|\d+\.\s*/, "").trim())
    .filter((l) => l.length > 10)
    .slice(0, 8);
}

function lineHasDateRange(line: string): boolean {
  DATE_RANGE.lastIndex = 0;
  return DATE_RANGE.test(line);
}

function extractDates(line: string): { start: string; end: string } | null {
  DATE_RANGE.lastIndex = 0;
  const m = DATE_RANGE.exec(line);
  if (!m?.[1] || !m[2]) return null;
  return { start: m[1].trim(), end: m[2].trim() };
}

function stripDatesFromLine(line: string): string {
  return line.replace(DATE_RANGE, "").replace(/\s+/g, " ").trim();
}

function looksLikeJobTitle(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 80) return false;
  if (isEducationTitle(t)) return false;
  if (lineHasDateRange(t)) return false;
  return JOB_TITLE_HINT.test(t) || (t.length < 55 && /^[A-Z]/.test(t));
}

function looksLikeCompany(line: string): boolean {
  const t = stripDatesFromLine(line);
  if (!t || t.length > 70) return false;
  if (isEducationTitle(t)) return false;
  if (/^[•\-\*]/.test(t)) return false;
  return true;
}

function parseRoleAtAnchor(
  lines: string[],
  anchorIdx: number,
  endIdx: number,
): ExperienceEntry | null {
  const dateLine = lines[anchorIdx];
  const dates = extractDates(dateLine);
  if (!dates) return null;

  let title = "";
  let company = "";
  let location: string | null = null;

  const withoutDates = stripDatesFromLine(dateLine);
  const atSplit = withoutDates.split(/\s+at\s+/i);
  if (atSplit.length === 2) {
    title = atSplit[0].trim();
    company = atSplit[1].trim();
  } else if (withoutDates.includes("|")) {
    const pipe = withoutDates.split("|").map((s) => s.trim());
    if (looksLikeJobTitle(pipe[0] ?? "")) {
      title = pipe[0] ?? "";
      company = pipe[1] ?? "";
      location = pipe[2] ?? null;
    } else {
      company = pipe[0] ?? "";
      title = pipe[1] ?? "";
    }
  } else if (looksLikeJobTitle(withoutDates)) {
    title = withoutDates;
  } else if (looksLikeCompany(withoutDates)) {
    company = withoutDates;
  }

  if (anchorIdx > 0) {
    const prev = lines[anchorIdx - 1];
    if (!title && looksLikeJobTitle(prev)) title = prev.trim();
    else if (!company && looksLikeCompany(prev) && !lineHasDateRange(prev)) {
      company = stripDatesFromLine(prev);
    }
  }

  if (anchorIdx + 1 < endIdx) {
    const next = lines[anchorIdx + 1];
    if (!company && looksLikeCompany(next) && !/^[•\-\*]/.test(next)) {
      company = stripDatesFromLine(next);
    } else if (!title && looksLikeJobTitle(next)) {
      title = next.trim();
    }
  }

  let bodyStart = anchorIdx + 1;
  while (bodyStart < endIdx) {
    const bl = lines[bodyStart];
    if (/^[•\-\*▪]/.test(bl) || /^\d+\.\s/.test(bl)) break;
    if (lineHasDateRange(bl)) break;
    const norm = stripDatesFromLine(bl);
    if (norm === company || norm === title) {
      bodyStart += 1;
      continue;
    }
    if (looksLikeCompany(bl) || looksLikeJobTitle(bl)) {
      bodyStart += 1;
      continue;
    }
    break;
  }
  const bullets = parseBulletsFromLines(lines.slice(bodyStart, endIdx));

  title = title.trim();
  company = company.trim();
  if (!title || !company) return null;

  return {
    title,
    company,
    company_type: inferCompanyType(company, bullets.join(" ")),
    location,
    start_date: dates.start,
    end_date: dates.end,
    bullets,
  };
}

export function extractExperienceSectionRaw(
  resumeText: string,
  sections: Map<string, string[]>,
): string {
  const expLines =
    sections.get("experience") ??
    sections.get("work experience") ??
    sections.get("professional experience") ??
    [];
  if (expLines.length) {
    return expLines.join("\n").trim();
  }
  const lines = resumeText.split(/\r?\n/).map((l) => l.trim());
  const out: string[] = [];
  let inExp = false;
  for (const line of lines) {
    const clean = line.replace(/[#*_]/g, "").trim();
    if (/^(?:work\s+)?experience|employment|professional\s+experience/i.test(clean)) {
      inExp = true;
      continue;
    }
    if (inExp && EDUCATION_SECTION_LINE.test(clean)) break;
    if (inExp && line) out.push(line);
  }
  return out.join("\n").trim();
}

export function parseExperienceEntries(
  resumeText: string,
  sections: Map<string, string[]>,
): ExperienceEntry[] {
  const expLines =
    sections.get("experience") ??
    sections.get("work experience") ??
    sections.get("professional experience") ??
    [];

  const usingFullResume = expLines.length === 0;
  const source =
    expLines.length > 0
      ? expLines
      : resumeText.split(/\r?\n/).map((l) => l.trim());

  const lines: string[] = [];
  for (const line of source) {
    if (!line) {
      if (lines.length && lines[lines.length - 1] !== "") lines.push("");
      continue;
    }
    if (usingFullResume && EDUCATION_SECTION_LINE.test(line.replace(/[#*_]/g, "").trim())) {
      break;
    }
    if (SECTION_HEADERS.test(line.replace(/[#*_]/g, "").trim()) && lines.length) {
      break;
    }
    lines.push(line);
  }

  const anchors: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lineHasDateRange(lines[i])) anchors.push(i);
  }

  const entries: ExperienceEntry[] = [];
  for (let a = 0; a < anchors.length; a++) {
    const start = anchors[a];
    const end = a + 1 < anchors.length ? anchors[a + 1] : lines.length;
    const entry = parseRoleAtAnchor(lines, start, end);
    if (entry && isValidExperienceEntry(entry)) {
      entries.push(entry);
    }
  }

  return entries;
}

export type ExperienceParseResult = {
  experience: ExperienceEntry[];
  experience_fallback_raw: string | null;
};

export function parseExperienceWithFallback(
  resumeText: string,
  sections: Map<string, string[]>,
): ExperienceParseResult {
  const experience = parseExperienceEntries(resumeText, sections);
  const valid = experience.filter((e) => isValidExperienceEntry(e));
  if (valid.length >= 1) {
    return { experience: valid, experience_fallback_raw: null };
  }
  const raw = extractExperienceSectionRaw(resumeText, sections);
  return {
    experience: [],
    experience_fallback_raw: raw.length > 40 ? raw : null,
  };
}

export function parseEducationEntries(
  sections: Map<string, string[]>,
): EducationEntry[] {
  const lines =
    sections.get("education") ?? sections.get("academic") ?? [];
  const entries: EducationEntry[] = [];

  for (const line of lines) {
    if (line.length < 6) continue;
    const yearMatch = line.match(/\b(19|20)\d{2}\b/);
    const parts = line.split(/[,|•]/).map((s) => s.trim());
    entries.push({
      institution: parts[0] ?? line,
      degree: parts[1] ?? null,
      field: parts[2] ?? null,
      year: yearMatch?.[0] ?? null,
    });
    if (entries.length >= 5) break;
  }
  return entries;
}

export function parseSkillsFromSection(
  sections: Map<string, string[]>,
): string[] {
  const lines =
    sections.get("skills") ??
    sections.get("technical skills") ??
    sections.get("core competencies") ??
    [];
  const raw = lines.join(", ");
  return raw
    .split(/[,;|•\/]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 40)
    .slice(0, 40);
}

export function extractExplicitYearsOfExperience(
  resumeText: string,
  sections: Map<string, string[]>,
): number | null {
  const summaryBlock = [
    ...(sections.get("summary") ?? []),
    ...(sections.get("professional summary") ?? []),
    ...(sections.get("profile") ?? []),
  ].join(" ");
  const blob = `${summaryBlock} ${resumeText.slice(0, 2000)}`;

  const patterns = [
    /(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+(?:professional|work|industry|software|engineering|IT|relevant))?\s+experience/i,
    /(?:over|more than|at least)\s+(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)/i,
    /(?:experience)\s*[:\-–]\s*(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)/i,
    /(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience|in\s+(?:software|engineering|the\s+industry))/i,
    /(?:with|having)\s+(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)/i,
  ];

  for (const pattern of patterns) {
    const match = blob.match(pattern);
    if (match?.[1]) {
      const n = parseFloat(match[1]);
      if (Number.isFinite(n) && n >= 0 && n <= 50) {
        return Math.round(n * 10) / 10;
      }
    }
  }
  return null;
}

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export function parseDateToMonth(value: string | null, asEnd: boolean): number | null {
  if (!value) return null;
  const v = value.trim();
  if (/present|current|now/i.test(v)) {
    const d = new Date();
    return d.getFullYear() * 12 + d.getMonth();
  }
  const monthYear = v.match(
    new RegExp(`\\b(${MONTH})\\.?\\s*((?:19|20)\\d{2})`, "i"),
  );
  if (monthYear) {
    const key = monthYear[1].slice(0, 3).toLowerCase();
    const month = MONTH_INDEX[key];
    const year = Number(monthYear[2]);
    if (month != null && Number.isFinite(year)) {
      return year * 12 + month;
    }
  }
  const slash = v.match(/\b(\d{1,2})\/(\d{4})\b/);
  if (slash) {
    return Number(slash[2]) * 12 + (Number(slash[1]) - 1);
  }
  const yearOnly = v.match(/\b((?:19|20)\d{2})\b/);
  if (yearOnly) {
    const year = Number(yearOnly[1]);
    return year * 12 + (asEnd ? 11 : 0);
  }
  return null;
}

export function roleDurationMonths(
  start: string | null,
  end: string | null,
): number {
  const startM = parseDateToMonth(start, false);
  const endM = parseDateToMonth(end, true);
  if (startM == null || endM == null) return 0;
  return Math.max(1, endM - startM + 1);
}

export function sumExperienceMonths(experience: ExperienceEntry[]): number {
  return experience
    .filter((e) => isValidExperienceEntry(e))
    .reduce((sum, job) => sum + roleDurationMonths(job.start_date, job.end_date), 0);
}

export function estimateYearsExperience(
  experience: ExperienceEntry[],
): string {
  const valid = experience.filter((e) => isValidExperienceEntry(e));
  if (!valid.length) return "Not stated";

  const totalMonths = sumExperienceMonths(valid);
  if (totalMonths <= 0) return "Not stated";

  const years = Math.max(1, Math.round(totalMonths / 12));
  return `${years} years`;
}

export function computeTrajectoryVelocity(
  experience: ExperienceEntry[],
): "fast" | "normal" | "slow" {
  const tenures: number[] = [];
  for (const job of experience) {
    const startY = parseYear(job.start_date);
    const endY = parseYear(job.end_date) ?? new Date().getFullYear();
    if (startY && endY >= startY) tenures.push(endY - startY + 0.5);
  }
  if (!tenures.length) return "normal";
  const avg = tenures.reduce((a, b) => a + b, 0) / tenures.length;
  if (avg < 2.2) return "fast";
  if (avg > 4) return "slow";
  return "normal";
}

function parseYear(value: string | null): number | null {
  if (!value) return null;
  const m = value.match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : null;
}

export function splitResumeSections(resumeText: string) {
  return splitSections(resumeText);
}

const PORTAL_NAMES =
  /\b(?:naukri|linkedin|indeed|monster|glassdoor|jobsearch|resumecom|hirist|apna|shine)\b/i;

const PHONE_PATTERN =
  /\+?\d{1,4}[-.\s]?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}|\b\d{10,15}\b/;

function capitalizeWord(w: string): string {
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function splitGluedNameToken(word: string): string[] | null {
  const parts = word
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return parts.map(capitalizeWord);
  }
  return null;
}

function isNameWord(w: string): boolean {
  return (
    /^[A-Z][A-Za-z'-]{1,}$/.test(w) ||
    /^[A-Z]{2,}$/.test(w) ||
    /^[A-Z]\.?$/.test(w)
  );
}

function looksLikeName(line: string): boolean {
  if (JOB_TITLE_HINT.test(line)) return false;
  if (/\[REDACTED/i.test(line)) return false;
  const words = line.trim().split(/\s+/);
  if (words.length >= 2 && words.length <= 4) {
    return words.every(isNameWord);
  }
  if (words.length === 1) {
    const w = words[0];
    if (w.length >= 4 && w.length <= 24 && isNameWord(w)) {
      return true;
    }
  }
  return false;
}

function extractNameFromHeaderChunk(chunk: string): string | null {
  const head = chunk.slice(0, 600).trim();
  if (!head) return null;

  const beforeTitle = head.split(
    /\b(?:software|senior|staff|lead|engineer|developer|architect|consultant|analyst|manager|summary|experience|education|skills|objective|profile)\b/i,
  )[0];
  const segment = (beforeTitle ?? head).trim();
  const candidates = [
    segment.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,3})\b/),
    segment.match(/^([A-Z]{2,}(?:\s+[A-Z]{2,}){1,3})\b/),
    segment.match(/^([A-Za-z]+(?:\s+[A-Za-z]+){1,3})\b/),
  ];
  for (const match of candidates) {
    const raw = match?.[1]?.trim();
    if (!raw || raw.length < 4 || raw.length > 48) continue;
    if (!looksLikeName(raw)) continue;
    return formatNameLine(raw);
  }
  return null;
}

function formatNameLine(line: string): string {
  const trimmed = line.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    const split = splitGluedNameToken(words[0]);
    if (split) return split.join(" ");
    return capitalizeWord(words[0]);
  }
  return words.map(capitalizeWord).join(" ");
}

export function extractNameFromRawResume(rawResumeText: string): string | null {
  const lines = rawResumeText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 12)) {
    if (/\[REDACTED/i.test(line)) continue;
    if (/\d/.test(line)) continue;
    if (/@/.test(line)) continue;
    if (/[|•·,;:(){}\[\]#@+~!%^&*<>]/.test(line)) continue;
    if (/linkedin\.com|github\.com|http/i.test(line)) continue;
    if (PORTAL_NAMES.test(line)) continue;
    if (line.length < 3 || line.length > 48) continue;
    if (!looksLikeName(line)) continue;
    return formatNameLine(line);
  }

  if (lines.length === 1 && lines[0].length > 80) {
    return extractNameFromHeaderChunk(lines[0]);
  }
  if (lines.length > 0) {
    return extractNameFromHeaderChunk(lines.slice(0, 3).join(" "));
  }
  return extractNameFromHeaderChunk(rawResumeText);
}

export function extractTitleFromResumeHeader(resumeText: string): string | null {
  const lines = resumeText.split(/\r?\n/).slice(0, 50);
  for (const line of lines) {
    const t = line.trim();
    if (t.length < 5 || t.length > 120) continue;
    if (/\[REDACTED/i.test(t)) continue;
    if (/@/.test(t) || PHONE_PATTERN.test(t) || /linkedin\.com|github\.com|http/i.test(t)) continue;
    if (PORTAL_NAMES.test(t)) continue;
    DATE_RANGE.lastIndex = 0;
    if (DATE_RANGE.test(t) || isEducationTitle(t)) continue;
    if (SECTION_HEADERS.test(t.replace(/[#*_]/g, "").trim())) continue;
    if (/^[•\-\*]/.test(t)) continue;
    if (!JOB_TITLE_HINT.test(t)) continue;
    // Extract just the title portion if the line has a name prefix or pipe-separated junk
    const titleMatch = t.match(
      /(?:^|(?<=[|\s,]))\s*((?:(?:Staff|Senior|Sr\.?|Junior|Jr\.?|Principal|Lead|Associate|Head\s+of)\s+)?(?:Software|Data|ML|Machine\s+Learning|Frontend|Back[- ]?end|Full[- ]?Stack|Cloud|DevOps|Platform|Site\s+Reliability|Product|QA|Mobile|iOS|Android|Embedded)?\s*(?:Engineer|Developer|Architect|Manager|Analyst|Consultant|Scientist|Designer|Director|Specialist|Administrator|Tester|Coordinator|Lead)\b[^|,\n]{0,40})/i,
    );
    if (titleMatch?.[1]?.trim()) return titleMatch[1].trim().slice(0, 70);
    // Fall back to the full line only if it doesn't look like a name
    if (!looksLikeName(t) && t.length <= 70) return t;
  }
  return null;
}

export function extractCurrentCompany(rawResumeText: string): string | null {
  const lines = rawResumeText.split(/\r?\n/).slice(0, 60);

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || t.length > 100) continue;
    if (/\[REDACTED/i.test(t) || /@/.test(t) || PHONE_PATTERN.test(t)) continue;
    if (/linkedin\.com|github\.com|http/i.test(t)) continue;
    if (PORTAL_NAMES.test(t)) continue;
    DATE_RANGE.lastIndex = 0;
    if (DATE_RANGE.test(t)) continue;

    // "Software Engineer at Google" on one line
    const atMatch = t.match(/^.+?\s+at\s+(.+)$/i);
    if (atMatch && JOB_TITLE_HINT.test(t)) {
      const co = atMatch[1].split(/[|,]/)[0].trim();
      if (co.length >= 2 && co.length <= 60) return co;
    }

    // Pipe-separated: "Software Engineer | Google | Bangalore"
    if (JOB_TITLE_HINT.test(t) && t.includes("|")) {
      const parts = t.split("|").map((s) => s.trim());
      for (let j = 0; j < parts.length; j++) {
        if (JOB_TITLE_HINT.test(parts[j])) {
          const co = parts[j + 1];
          if (co && co.length >= 2 && co.length <= 60 && !/\d{3}/.test(co) && !/@/.test(co)) {
            return co;
          }
        }
      }
    }

    // Title on one line, company on the very next non-empty line
    if (JOB_TITLE_HINT.test(t) && !looksLikeName(t)) {
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const next = lines[j].trim();
        if (!next) continue;
        if (/\[REDACTED/i.test(next) || /@/.test(next) || PHONE_PATTERN.test(next)) continue;
        DATE_RANGE.lastIndex = 0;
        if (DATE_RANGE.test(next)) break;
        if (JOB_TITLE_HINT.test(next)) break;
        if (SECTION_HEADERS.test(next.replace(/[#*_]/g, "").trim())) break;
        if (/^[•\-\*]/.test(next)) break;
        if (isEducationTitle(next)) continue;
        if (next.length >= 2 && next.length <= 60 && /^[A-Z]/.test(next)) return next;
      }
      break;
    }
  }
  return null;
}

export function extractFirstSubstantialLine(resumeText: string): string {
  const lines = resumeText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(3, 30)) {
    if (/@/.test(line) || /\d{3}[-.\s]\d{3}/.test(line)) continue;
    if (SECTION_HEADERS.test(line.replace(/[#*_]/g, "").trim())) break;
    if (/^[•\-\*]/.test(line)) continue;
    DATE_RANGE.lastIndex = 0;
    if (DATE_RANGE.test(line)) continue;
    if (isEducationTitle(line)) continue;
    const wordCount = line.split(/\s+/).length;
    if (wordCount >= 6 && line.length >= 40) return line.slice(0, 300);
  }
  return "";
}

export function summaryFromRecentRole(experience: ExperienceEntry[]): string {
  const recent = experience.find((e) => isValidExperienceEntry(e)) ?? experience[0];
  if (!recent) return "";
  const bullets = recent.bullets.filter(Boolean);
  if (bullets[0] && bullets[0].length >= 20) {
    return bullets[0].slice(0, 500);
  }
  if (bullets.length >= 2) {
    return `${bullets[0]} ${bullets[1]}`.slice(0, 500);
  }
  return "";
}

function isBulletOrSkillList(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return false;
  const bulletLines = lines.filter((l) => /^[•\-\*▪]/.test(l.trim())).length;
  if (bulletLines >= lines.length * 0.5) return true;
  return (text.match(/,/g)?.length ?? 0) > 10;
}

export function extractSummaryAfterLabels(resumeText: string): string {
  const lines = resumeText.split(/\r?\n/).map((l) => l.trim());
  const labelPattern =
    /^(?:#{1,3}\s*)?(?:summary|professional\s+summary|about\s+me|profile|objective|career\s+objective)\s*:?\s*(.*)$/i;

  for (let i = 0; i < Math.min(lines.length, 60); i++) {
    const m = lines[i].match(labelPattern);
    if (!m) continue;

    const inline = m[1]?.trim();
    if (inline && inline.split(/\s+/).filter(Boolean).length >= 8) {
      return inline.slice(0, 500);
    }

    const collected: string[] = [];
    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
      const line = lines[j];
      if (!line) break;
      if (SECTION_HEADERS.test(line.replace(/[#*_]/g, "").trim())) break;
      DATE_RANGE.lastIndex = 0;
      if (DATE_RANGE.test(line)) break;
      if (/^[•\-\*]/.test(line)) break;
      collected.push(line);
    }
    const block = collected.join(" ").replace(/\s+/g, " ").trim();
    if (block.split(/\s+/).filter(Boolean).length >= 8) {
      return block.slice(0, 500);
    }
  }
  return "";
}

export function longestParagraphInHeader(
  resumeText: string,
  lineCount: number,
  minWords: number,
): string {
  const lines = resumeText.split(/\r?\n/).map((l) => l.trim()).slice(0, lineCount);
  let best = "";
  let current: string[] = [];

  const flush = () => {
    const text = current.join(" ").replace(/\s+/g, " ").trim();
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (
      wordCount >= minWords &&
      text.length > best.length &&
      !isBulletOrSkillList(text) &&
      !/@/.test(text) &&
      !SECTION_HEADERS.test(text.replace(/[#*_]/g, "").trim())
    ) {
      DATE_RANGE.lastIndex = 0;
      if (!DATE_RANGE.test(text)) best = text;
    }
    current = [];
  };

  for (const line of lines) {
    if (!line) {
      flush();
      continue;
    }
    if (/^[•\-\*▪]/.test(line)) {
      flush();
      continue;
    }
    const clean = line.replace(/[#*_]/g, "").trim();
    if (SECTION_HEADERS.test(clean)) {
      flush();
      continue;
    }
    current.push(line);
  }
  flush();
  return best.slice(0, 500);
}

export function buildExperienceSummaryFallback(
  totalYears: string,
  mostRecentTitle: string,
  experience: ExperienceEntry[],
): string {
  const recent = experience.find((e) => isValidExperienceEntry(e));
  const n = totalYears.match(/(\d+)/)?.[1];
  const types = [
    ...new Set(
      experience
        .map((e) => e.company_type)
        .filter((t) => t && t !== "Services"),
    ),
  ];
  const env =
    types.length > 0
      ? types.map((t) => t.toLowerCase()).join(" and ")
      : "product and platform";

  if (n) {
    return `${n} years of software engineering experience across ${env} roles.`;
  }
  if (mostRecentTitle) {
    return `Experienced ${mostRecentTitle} with background across ${env} roles.`;
  }
  if (recent?.title) {
    return `Experienced ${recent.title} with background across ${env} roles.`;
  }
  return `Professional experience across ${env} roles.`;
}

export function resolveProfessionalSummary(
  resumeText: string,
  sections: Map<string, string[]>,
  experience: ExperienceEntry[],
  opts: {
    totalYears: string;
    mostRecentTitle: string;
  },
): string {
  const afterLabel = extractSummaryAfterLabels(resumeText);
  if (afterLabel.length >= 40) return afterLabel;

  const fromSection = extractProfessionalSummary(resumeText, sections);
  if (fromSection.length >= 40) return fromSection;

  const paragraph = longestParagraphInHeader(resumeText, 20, 40);
  if (paragraph.length >= 40) return paragraph;

  const fromRole = summaryFromRecentRole(experience);
  if (fromRole.length >= 20) return fromRole;

  const substantial = extractFirstSubstantialLine(resumeText);
  if (substantial.length >= 40) return substantial;

  return buildExperienceSummaryFallback(
    opts.totalYears,
    opts.mostRecentTitle,
    experience,
  );
}
