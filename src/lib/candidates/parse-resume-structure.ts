import type { CompanyType } from "@/types/score";
import type { EducationEntry, ExperienceEntry } from "@/types/candidate";

const SECTION_HEADERS =
  /^(?:professional\s+)?(?:summary|profile|objective|about)\s*$|^(?:work\s+)?experience|employment|professional\s+experience|career\s+history|education|academic|skills|technical\s+skills|core\s+competencies$/i;

const DATE_RANGE =
  /(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\b\d{1,2}\/\d{4}|\b\d{4})\s*[-–—]\s*(\b(?:Present|Current|Now|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*(?:\d{4})?|\b\d{1,2}\/\d{4}|\b\d{4})/i;

const PRODUCT_HINTS =
  /\b(?:google|meta|microsoft|amazon|apple|netflix|spotify|uber|airbnb|stripe|shopify|atlassian|salesforce|adobe|linkedin|twitter|x\.com|flipkart|swiggy|zomato|razorpay|phonepe|paytm|freshworks|zendesk|hubspot|notion|figma|slack|dropbox|palantir|snowflake|databricks|openai|anthropic)\b/i;

const SERVICES_HINTS =
  /\b(?:accenture|deloitte|pwc|kpmg|ey |infosys|tcs|wipro|cognizant|capgemini|hcl|tech\s*mahindra|ltimindtree|mphasis|genpact|ibm\s+consulting|dxc|ntt\s+data)\b/i;

const GCC_HINTS =
  /\b(?:gcc|global\s+capability|offshore|shared\s+services|captives?)\b/i;

const STARTUP_HINTS =
  /\b(?:startup|series\s+[a-d]|seed\s+stage|early[- ]stage|venture[- ]backed)\b/i;

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
  const summaryLines =
    sections.get("summary") ??
    sections.get("professional summary") ??
    sections.get("profile") ??
    [];
  if (summaryLines.length) {
    return summaryLines.join(" ").replace(/\s+/g, " ").trim();
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

function parseBullets(lines: string[]): string[] {
  return lines
    .filter((l) => /^[•\-\*▪]/.test(l) || /^\d+\./.test(l))
    .map((l) => l.replace(/^[•\-\*▪]\s*|\d+\.\s*/, "").trim())
    .filter((l) => l.length > 10)
    .slice(0, 3);
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

  const source =
    expLines.length > 0
      ? expLines
      : resumeText.split(/\r?\n/).map((l) => l.trim());

  const entries: ExperienceEntry[] = [];
  let i = 0;

  while (i < source.length && entries.length < 12) {
    const line = source[i];
    if (!line || SECTION_HEADERS.test(line)) {
      i += 1;
      continue;
    }

    const dateOnLine = DATE_RANGE.exec(line);
    let title = "";
    let company = "";
    let location: string | null = null;
    let start_date: string | null = null;
    let end_date: string | null = null;
    const bullets: string[] = [];
    let j = i;

    if (dateOnLine) {
      const parts = line.split(/\s*[-–—|@]\s*/);
      title = parts[0]?.replace(DATE_RANGE, "").trim() ?? "";
      start_date = dateOnLine[1] ?? null;
      end_date = dateOnLine[2] ?? null;
      j = i + 1;
      if (j < source.length && !DATE_RANGE.test(source[j])) {
        const next = source[j];
        if (!/^[•\-\*]/.test(next) && next.length < 80) {
          company = next;
          j += 1;
        }
      }
    } else if (i + 1 < source.length && DATE_RANGE.test(source[i + 1])) {
      title = line;
      const dateLine = source[i + 1];
      const dr = DATE_RANGE.exec(dateLine);
      if (dr) {
        start_date = dr[1];
        end_date = dr[2];
      }
      const companyPart = dateLine.replace(DATE_RANGE, "").trim();
      if (companyPart) company = companyPart;
      j = i + 2;
    } else if (line.includes("|") || line.includes(" at ")) {
      const atSplit = line.split(/\s+at\s+/i);
      if (atSplit.length === 2) {
        title = atSplit[0].trim();
        company = atSplit[1].replace(DATE_RANGE, "").trim();
      } else {
        const pipe = line.split("|").map((s) => s.trim());
        title = pipe[0] ?? line;
        company = pipe[1] ?? "";
        location = pipe[2] ?? null;
      }
      j = i + 1;
    } else {
      i += 1;
      continue;
    }

    while (j < source.length) {
      const bl = source[j];
      if (!bl) {
        j += 1;
        break;
      }
      if (DATE_RANGE.test(bl) && bullets.length > 0) break;
      if (SECTION_HEADERS.test(bl)) break;
      if (/^[•\-\*▪]/.test(bl) || /^\d+\./.test(bl)) {
        bullets.push(bl.replace(/^[•\-\*▪]\s*|\d+\.\s*/, "").trim());
        if (bullets.length >= 3) {
          j += 1;
          continue;
        }
      } else if (bullets.length > 0 && bl.length > 20) {
        break;
      } else if (!company && bl.length < 60 && !DATE_RANGE.test(bl)) {
        company = bl;
      }
      j += 1;
      if (bullets.length >= 3 && j < source.length && DATE_RANGE.test(source[j]))
        break;
    }

    if (title || company) {
      const companyClean = company.replace(DATE_RANGE, "").trim() || "Company";
      entries.push({
        title: title || "Role",
        company: companyClean,
        company_type: inferCompanyType(companyClean, bullets.join(" ")),
        location,
        start_date,
        end_date,
        bullets: bullets.slice(0, 3),
      });
    }
    i = j > i ? j : i + 1;
  }

  return entries;
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

export function estimateYearsExperience(
  experience: ExperienceEntry[],
): string {
  if (!experience.length) return "Not stated";
  let earliest = Infinity;
  let latest = 0;
  const yearRe = /\b(19|20)(\d{2})\b/g;

  for (const job of experience) {
    for (const part of [job.start_date, job.end_date]) {
      if (!part || /present|current/i.test(part)) {
        latest = Math.max(latest, new Date().getFullYear());
        continue;
      }
      let m: RegExpExecArray | null;
      const s = part;
      yearRe.lastIndex = 0;
      while ((m = yearRe.exec(s))) {
        const y = Number(m[0]);
        earliest = Math.min(earliest, y);
        latest = Math.max(latest, y);
      }
    }
  }

  if (earliest === Infinity) return "Not stated";
  const years = Math.max(1, latest - earliest + 1);
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

export function summaryFromRecentRole(experience: ExperienceEntry[]): string {
  const recent = experience[0];
  if (!recent) return "";
  const bullets = recent.bullets.filter(Boolean);
  if (bullets.length >= 2) {
    return `${recent.title} at ${recent.company}: ${bullets[0]} ${bullets[1]}`;
  }
  if (bullets[0]) {
    return `${recent.title} at ${recent.company}. ${bullets[0]}`;
  }
  return `${recent.title} at ${recent.company}, contributing in a ${recent.company_type.toLowerCase()} environment.`;
}
