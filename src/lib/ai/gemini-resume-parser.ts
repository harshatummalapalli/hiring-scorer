import {
  GEMINI_PARSE_MODEL,
  geminiParseLane,
  getGeminiClient,
} from "@/lib/gemini-client";

export type GeminiParsedResume = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  current_title: string | null;
  current_company: string | null;
  duration_at_current_company: string | null;
  total_years_experience: string | null;
  location: string | null;
  career_summary: string | null;
  work_history: Array<{
    title: string;
    company: string;
    start: string | null;
    end: string | null;
    duration: string | null;
    bullets: string[];
  }>;
  education: Array<{
    institution: string;
    degree: string | null;
    field: string | null;
    year: string | null;
  }>;
  skill_groups: Array<{
    category: string;
    skills: string[];
  }>;
  career_gaps: Array<{
    from: string;
    to: string;
    months: number;
  }>;
};

const SYSTEM_PROMPT = `You are a precise resume parser. Extract structured 
information from the resume text provided.

SKILL GROUPS — use exactly these categories, in this order, 
include only categories that have at least one skill found:
1. Programming Languages
2. Frameworks & Libraries
3. Databases
4. AI & Machine Learning
5. Cloud & DevOps
6. Domain & Tools

Within each category, order skills by density — skills appearing most 
frequently and in work descriptions first, skills appearing only in a 
skills section last.

WORK HISTORY — extract each role with:
- title, company, start (MMM YYYY), end (MMM YYYY or "Present")
- duration as a clean string e.g. "2 years 3 months"
- up to 5 key bullets from the role description

CAREER GAPS — identify gaps between consecutive roles longer than 
3 months. Calculate months as integer.

TOTAL YEARS EXPERIENCE — calculate from earliest role to present. 
Return as a clean string e.g. "8 years" or "3.5 years".

CAREER SUMMARY — write 2-3 factual sentences describing the career 
arc. Do not copy text from the resume. Do not include PII.

CURRENT TITLE AND COMPANY — strict rules:
- current_title must contain ONLY the job title — never a name, 
  phone number, email, or URL. If the resume header mixes name 
  and title on the same line, extract only the title portion.
- current_company must contain ONLY the company name — never 
  a phone number or contact detail.
- If you are unsure whether a value belongs in current_title or is 
  contact/identity information, leave current_title as null rather 
  than including mixed content.

Return ONLY valid JSON. No markdown, no preamble, no backticks.`;

const MAX_OUTPUT_TOKENS = 8192;

function stripJsonFences(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

const PII_PLACEHOLDER_RE =
  /\[EMAIL\]|\[PHONE\]|\[URL\]|\[NAME\]|\[LINKEDIN\]|\[GITHUB\]/gi;

function stripPlaceholders(val: string | null): string | null {
  if (!val) return null;
  const cleaned = val
    .replace(PII_PLACEHOLDER_RE, "")
    .replace(/\s*[·\-|,]\s*$/, "")
    .replace(/^\s*[·\-|,]\s*/, "")
    .trim();
  return cleaned || null;
}

const DESCRIPTION_PATTERNS = [
  /involved in/i,
  /responsible for/i,
  /working on/i,
  /developed/i,
  /designed and/i,
  /managed/i,
  /led the/i,
  /building/i,
];

function normalizeGeminiParsedRecord(record: GeminiParsedResume): GeminiParsedResume {
  const normalized: GeminiParsedResume = {
    ...record,
    full_name: record.full_name?.trim() || null,
    email: record.email?.trim() || null,
    phone: record.phone?.trim() || null,
    linkedin_url: record.linkedin_url?.trim() || null,
    github_url: record.github_url?.trim() || null,
    current_title: record.current_title?.trim() || null,
    current_company: record.current_company?.trim() || null,
    total_years_experience: record.total_years_experience?.trim() || null,
    location: record.location?.trim() || null,
    career_summary: record.career_summary?.trim() || null,
    work_history: (record.work_history ?? [])
      .map((w) => ({
        title: String(w.title ?? "").trim(),
        company: String(w.company ?? "").trim(),
        start: w.start?.trim() || null,
        end: w.end?.trim() || null,
        duration: w.duration?.trim() || null,
        bullets: (w.bullets ?? []).map((b) => String(b).trim()).filter(Boolean),
      }))
      .filter((w) => w.title || w.company),
    education: record.education ?? [],
    skill_groups: (record.skill_groups ?? []).map((g) => ({
      category: String(g.category ?? "").trim(),
      skills: (g.skills ?? []).map((s) => String(s).trim()).filter(Boolean),
    })),
    career_gaps: record.career_gaps ?? [],
  };

  // Cleanup 1 — strip candidate name from current_title
  if (
    normalized.full_name &&
    normalized.current_title &&
    normalized.current_title
      .toLowerCase()
      .startsWith(normalized.full_name.toLowerCase())
  ) {
    normalized.current_title =
      normalized.current_title
        .slice(normalized.full_name.length)
        .replace(/^[\s,\-·|]+/, "")
        .trim() || null;
  }

  // Cleanup 2 — strip PII placeholders
  normalized.current_title = stripPlaceholders(normalized.current_title);
  normalized.current_company = stripPlaceholders(normalized.current_company);
  normalized.career_summary = stripPlaceholders(normalized.career_summary);

  // Cleanup 3 — title duplicated as company
  if (
    normalized.current_title &&
    normalized.current_company &&
    normalized.current_title.toLowerCase() ===
      normalized.current_company.toLowerCase()
  ) {
    const firstJob = normalized.work_history[0];
    normalized.current_company = firstJob?.company?.trim() || null;
  }

  // Cleanup 4 — job description text in company field
  if (normalized.current_company && normalized.current_company.length > 60) {
    const firstJob = normalized.work_history[0];
    normalized.current_company = firstJob?.company?.trim() || null;
  }

  if (
    normalized.current_company &&
    DESCRIPTION_PATTERNS.some((p) => p.test(normalized.current_company!))
  ) {
    const firstJob = normalized.work_history[0];
    normalized.current_company = firstJob?.company?.trim() || null;
  }

  // Cleanup 5 — strip category prefix from skill names
  normalized.skill_groups = normalized.skill_groups.map((g) => ({
    ...g,
    skills: g.skills
      .map((s) => {
        const colonIdx = s.indexOf(":");
        if (colonIdx > 0 && colonIdx < 20 && s.length - colonIdx > 2) {
          return s.slice(colonIdx + 1).trim();
        }
        return s;
      })
      .filter(Boolean),
  }));

  // Cleanup 6 — fallback title and company from work_history
  if (!normalized.current_title && normalized.work_history.length > 0) {
    normalized.current_title = normalized.work_history[0].title || null;
  }
  if (!normalized.current_company && normalized.work_history.length > 0) {
    normalized.current_company = normalized.work_history[0].company || null;
  }

  return normalized;
}

function hasUsefulParse(record: GeminiParsedResume): boolean {
  return (
    record.work_history.length > 0 ||
    record.skill_groups.some((g) => g.skills.length > 0) ||
    Boolean(record.current_title?.trim()) ||
    Boolean(record.total_years_experience?.trim())
  );
}

function parseGeminiResumeJson(text: string): GeminiParsedResume {
  const cleaned = stripJsonFences(text);
  try {
    return normalizeGeminiParsedRecord(JSON.parse(cleaned) as GeminiParsedResume);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return normalizeGeminiParsedRecord(
          JSON.parse(cleaned.slice(start, end + 1)) as GeminiParsedResume,
        );
      } catch {
        /* fall through */
      }
    }
    throw new Error(
      `Gemini resume parser returned invalid JSON. First 200 chars: ${text.slice(0, 200)}`,
    );
  }
}

async function callWithRetry(
  fn: () => Promise<string>,
  maxAttempts = 3,
): Promise<string> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const text = await fn();
      if (
        !text.includes("{") ||
        text.startsWith("An error") ||
        text.startsWith("I'm sorry") ||
        text.startsWith("Sorry")
      ) {
        throw new Error(`Non-JSON response: ${text.slice(0, 80)}`);
      }
      return text;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      await new Promise((r) =>
        setTimeout(r, 800 * Math.pow(2, attempt - 1)),
      );
    }
  }
  throw new Error("All retry attempts failed");
}

async function requestGeminiParse(
  rawResumeText: string,
  compact: boolean,
): Promise<GeminiParsedResume> {
  const client = getGeminiClient();

  const compactRules = compact
    ? `

Output size limits (strict):
- Include at most 6 most recent work_history entries with max 3 bullets each
- Keep career_summary to 2 sentences
- Omit career_gaps if needed to produce complete valid JSON`
    : "";

  const prompt = `${SYSTEM_PROMPT}${compactRules}

RESUME TEXT:
${rawResumeText.slice(0, 8000)}

Return a JSON object matching this exact schema:
{
  "full_name": "string or null",
  "email": "string or null",
  "phone": "string or null",
  "linkedin_url": "full URL string or null",
  "github_url": "full URL string or null",
  "current_title": "job title only — no name, phone, email, or URL; null if unsure",
  "current_company": "company name only — no phone or contact detail; null if unknown",
  "duration_at_current_company": "e.g. '1 year 4 months' or null",
  "total_years_experience": "e.g. '8 years' or null",
  "location": "City, Country or null",
  "career_summary": "2-3 sentences or null",
  "work_history": [
    {
      "title": "string",
      "company": "string",
      "start": "MMM YYYY or null",
      "end": "MMM YYYY or Present",
      "duration": "string or null",
      "bullets": ["string"]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string or null",
      "field": "string or null",
      "year": "string or null"
    }
  ],
  "skill_groups": [
    { "category": "string", "skills": ["string"] }
  ],
  "career_gaps": [
    { "from": "MMM YYYY", "to": "MMM YYYY", "months": 0 }
  ]
}`;

  const text = await callWithRetry(async () => {
    const parseStart = Date.now();
    const response = await client.models.generateContent({
      model: GEMINI_PARSE_MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        temperature: 0,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
    });
    const parseMs = Date.now() - parseStart;
    console.log(
      `[gemini-parse] model=${GEMINI_PARSE_MODEL} lane=${geminiParseLane()} duration=${parseMs}ms`,
    );

    const rawText =
      response.text ??
      response.candidates?.[0]?.content?.parts?.[0]?.text ??
      "";
    const trimmed = rawText.trim();
    if (!trimmed) {
      throw new Error("Gemini returned empty response");
    }
    return trimmed;
  });

  if (!text) {
    throw new Error("Resume parser returned an empty response.");
  }

  return parseGeminiResumeJson(text);
}

export async function parseResumeWithGemini(
  rawResumeText: string,
  stallMs = 0,
): Promise<GeminiParsedResume> {
  if (stallMs > 0) {
    await new Promise((r) => setTimeout(r, stallMs));
  }
  let lastError: Error | null = null;
  let lastRecord: GeminiParsedResume | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const record = await requestGeminiParse(rawResumeText, attempt === 1);
      lastRecord = record;
      if (hasUsefulParse(record) || attempt === 2) {
        return record;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const retryable =
        lastError.message.includes("invalid JSON") ||
        lastError.message.includes("output token limit") ||
        lastError.message.includes("empty response");
      if (!retryable && attempt === 2) break;
      if (attempt === 2 && lastRecord) return lastRecord;
      if (attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }

  if (lastRecord) return lastRecord;
  throw lastError ?? new Error("Gemini resume parser failed.");
}
