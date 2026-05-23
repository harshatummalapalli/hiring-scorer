import { GoogleGenerativeAI } from "@google/generative-ai";
import { getApiKey, getGeminiModel } from "@/lib/ai/api-keys";

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

export async function parseResumeWithGemini(
  rawResumeText: string,
): Promise<GeminiParsedResume> {
  const apiKey = getApiKey("google");
  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: getGeminiModel(),
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0,
    },
  });

  const prompt = `${SYSTEM_PROMPT}

RESUME TEXT:
${rawResumeText.slice(0, 15000)}

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

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  try {
    const clean = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    return JSON.parse(clean) as GeminiParsedResume;
  } catch {
    throw new Error(
      `Gemini resume parser returned invalid JSON. First 200 chars: ${text.slice(0, 200)}`,
    );
  }
}
