import {
  cleanDisplayName,
  composeNameFromParts,
} from "@/lib/candidates/resolve-display-name";
import { splitFullName } from "@/lib/candidates/parse-resume-identity";
import { parseJsonFromModel } from "@/lib/ai/parse-json";
import type {
  CandidateSignalProfile,
  ExperienceEntry,
  EducationEntry,
  VerifiedSkill,
} from "@/types/candidate";
import type { CompanyType, ResumeQualitySignals } from "@/types/score";

export const EXTRACTION_PROMPT = `You are a resume parser for a recruiting platform. Extract ALL information accurately from the resume. Do not invent or assume anything not stated.

Return ONLY valid JSON with this exact structure:

{
  "display_name": "Full name as written in resume",
  "first_name": "First name only",
  "last_name": "Last name only (may be multiple words)",
  "current_title": "Most recent job title",
  "current_company": "Most recent employer",
  "location": "City, State/Country if present, else null",
  "total_years_experience": "X years (calculate from dates, or use stated value)",
  "professional_summary": "2-3 sentences summarising background, strengths, and what they bring. Write in third person.",
  "experience": [
    {
      "title": "Exact job title",
      "company": "Exact company name",
      "company_type": "Product|Services|GCC|Startup",
      "location": "City or null",
      "start_date": "Mon YYYY or YYYY",
      "end_date": "Mon YYYY or Present",
      "bullets": ["key achievement or responsibility (max 3 per role)"]
    }
  ],
  "education": [
    {
      "institution": "University or college name",
      "degree": "B.Tech / B.E / MBA / M.Tech / B.Sc / etc",
      "field": "Computer Science / Information Technology / etc",
      "year": "Graduation year as YYYY"
    }
  ],
  "top_skills": ["skill1", "skill2"],
  "signals": {
    "ownership_level": "Strong|Moderate|Weak",
    "ownership_evidence": "Direct quote from a bullet point showing ownership language",
    "ownership_examples": ["example 1", "example 2"],
    "quantification_level": "Strong|Moderate|Weak",
    "quantification_evidence": "Direct quote showing a metric or number",
    "quantified_examples": ["example 1", "example 2"],
    "career_trajectory": "fast|normal|slow",
    "trajectory_reasoning": "1 sentence explanation",
    "company_progression": "e.g. Services → Product or Product → GCC",
    "shows_product_progression": true,
    "keyword_risk": false,
    "keyword_risk_explanation": "Explanation if flagged, else empty string"
  }
}

NAME RULES (critical):
- display_name, first_name, and last_name must contain ONLY the candidate's personal name (typically 2-4 words).
- NEVER put employer names (Microsoft, Google, Amazon, etc.), cities, job titles, or resume portal names in display_name.
- Put the employer only in current_company and experience[].company.

CLASSIFICATION RULES:

company_type:
- Product: Companies that build and sell their own software products (Google, Microsoft, Amazon, Flipkart, Swiggy, Razorpay, Zepto, CRED, any funded startup with own product)
- Services: IT outsourcing / consulting firms (TCS, Infosys, Wipro, HCL, Cognizant, Accenture, Capgemini, Tech Mahindra, LTIMindtree)
- GCC: Global Capability Centres — Indian delivery/R&D arms of MNCs (Cisco GCC, JP Morgan tech centre, Goldman Sachs Bengaluru, Wells Fargo India, SAP Labs India)
- Startup: Early-stage companies (Seed / Series A-C, fewer than ~200 employees, or explicitly described as startup)

ownership_level:
- Strong: Most bullets start with first-person action verbs (Led, Built, Designed, Architected, Launched, Drove, Owned)
- Moderate: Mix of ownership and collaborative language
- Weak: Mostly passive ("Part of a team", "Assisted", "Contributed to", "Responsible for")

quantification_level:
- Strong: Most bullets contain concrete numbers, percentages, or business outcomes (reduced latency by 40%, grew revenue by $2M)
- Moderate: A few metrics present
- Weak: Mostly descriptive, little to no numbers

career_trajectory:
- fast: Average tenure < 2 years per role, OR clear upward title progression (Engineer → Senior → Staff → Principal within 6–8 years)
- slow: Average tenure > 5 years with minimal title change
- normal: Everything else

shows_product_progression: true if the most recent role is at a Product company and at least one previous role was at Services or GCC.

Provide up to 6 most recent experience entries. List top_skills in order of relevance (max 12).
If any field cannot be determined from the resume, use null for strings and [] for arrays.`;

export type ParsedResumeSignals = {
  ownership_level: string;
  ownership_evidence: string;
  ownership_examples: string[];
  quantification_level: string;
  quantification_evidence: string;
  quantified_examples: string[];
  career_trajectory: string;
  trajectory_reasoning: string;
  company_progression: string;
  shows_product_progression: boolean;
  keyword_risk: boolean;
  keyword_risk_explanation: string;
};

export type ParsedResumeExperience = {
  title: string;
  company: string;
  company_type: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  bullets: string[];
};

export type ParsedResumeEducation = {
  institution: string;
  degree: string | null;
  field: string | null;
  year: string | null;
};

export type ParsedResumeProfile = {
  display_name: string;
  first_name: string;
  last_name: string;
  current_title: string;
  current_company: string | null;
  location: string | null;
  total_years_experience: string;
  professional_summary: string;
  experience: ParsedResumeExperience[];
  education: ParsedResumeEducation[];
  top_skills: string[];
  signals: ParsedResumeSignals;
};

const VALID_COMPANY_TYPES: CompanyType[] = [
  "Product",
  "Services",
  "GCC",
  "Startup",
];

function toCompanyType(raw: string): CompanyType {
  const v = (raw ?? "").trim();
  return (VALID_COMPANY_TYPES as string[]).includes(v)
    ? (v as CompanyType)
    : "Services";
}

function toTrajectoryVelocity(raw: string): "fast" | "normal" | "slow" {
  if (raw === "fast") return "fast";
  if (raw === "slow") return "slow";
  return "normal";
}

function levelToRatio(level: string): number {
  if (level === "Strong") return 75;
  if (level === "Moderate") return 50;
  return 20;
}

function levelToQuantLabel(level: string): "consistent" | "sometimes" | "rarely" {
  if (level === "Strong") return "consistent";
  if (level === "Moderate") return "sometimes";
  return "rarely";
}

function buildResumeQuality(signals: ParsedResumeSignals): ResumeQualitySignals {
  const ownershipExamples = Array.isArray(signals.ownership_examples)
    ? signals.ownership_examples.filter(Boolean)
    : signals.ownership_evidence
      ? [signals.ownership_evidence]
      : [];
  const quantifiedExamples = Array.isArray(signals.quantified_examples)
    ? signals.quantified_examples.filter(Boolean)
    : signals.quantification_evidence
      ? [signals.quantification_evidence]
      : [];

  return {
    ownership: {
      ratio_percent: levelToRatio(signals.ownership_level),
      ownership_examples: ownershipExamples,
      participation_examples: [],
      ownership_count: ownershipExamples.length,
      participation_count: 0,
      neutral_count: 0,
      total_bullets: ownershipExamples.length * 2,
    },
    quantification: {
      ratio_percent: levelToRatio(signals.quantification_level),
      level: levelToQuantLabel(signals.quantification_level),
      quantified_examples: quantifiedExamples,
      quantified_count: quantifiedExamples.length,
      total_bullets: quantifiedExamples.length * 2,
    },
    keyword_stuffing: {
      flagged: !!signals.keyword_risk,
      explanation: signals.keyword_risk_explanation ?? "",
      skills_listed: 0,
      skills_in_work_context: 0,
      skills_in_work_percent: 0,
      work_bullet_quantified_percent: levelToRatio(
        signals.quantification_level,
      ),
    },
  };
}

export function mapParsedProfileToSignal(
  g: ParsedResumeProfile,
): CandidateSignalProfile {
  const signals = g.signals ?? ({} as ParsedResumeSignals);

  const experience: ExperienceEntry[] = (g.experience ?? []).map((e) => ({
    title: e.title ?? "",
    company: e.company ?? "",
    company_type: toCompanyType(e.company_type),
    location: e.location ?? null,
    start_date: e.start_date ?? null,
    end_date: e.end_date ?? null,
    bullets: Array.isArray(e.bullets) ? e.bullets.filter(Boolean) : [],
  }));

  const education: EducationEntry[] = (g.education ?? []).map((e) => ({
    institution: e.institution ?? "",
    degree: e.degree ?? null,
    field: e.field ?? null,
    year: e.year ?? null,
  }));

  const top_skills = Array.isArray(g.top_skills)
    ? g.top_skills.filter(Boolean)
    : [];
  const skills_verified: VerifiedSkill[] = top_skills
    .slice(0, 6)
    .map((skill) => ({
      skill,
      evidence: signals.ownership_evidence ?? "",
    }));
  const skills_listed_only: string[] = top_skills.slice(6);

  const career_types_sequence = experience.map((e) => e.company_type);

  const ownershipExamples = Array.isArray(signals.ownership_examples)
    ? signals.ownership_examples.filter(Boolean)
    : signals.ownership_evidence
      ? [signals.ownership_evidence]
      : [];

  const positive_signals = ownershipExamples.slice(0, 2).map((ex) => ({
    signal: "Demonstrates ownership language",
    evidence: ex,
  }));

  if (signals.quantification_evidence && positive_signals.length < 3) {
    positive_signals.push({
      signal: "Quantified business impact",
      evidence: signals.quantification_evidence,
    });
  }

  const watch_signals: string[] = [];
  if (signals.keyword_risk && signals.keyword_risk_explanation) {
    watch_signals.push(signals.keyword_risk_explanation);
  }
  if (signals.ownership_level === "Weak") {
    watch_signals.push(
      "Limited ownership language in role bullets — verify individual contribution in screen.",
    );
  }

  const display_name =
    composeNameFromParts(g.display_name, g.first_name, g.last_name) ??
    (cleanDisplayName(g.display_name?.trim() ?? "") || "Candidate");
  const identity = splitFullName(display_name);

  return {
    display_name,
    first_name: g.first_name?.trim() || identity.first_name,
    last_name: g.last_name?.trim() || identity.last_name,
    current_title: g.current_title?.trim() || null,
    most_recent_title: g.current_title ?? "",
    current_company: g.current_company ?? null,
    location: g.location ?? null,
    total_years_experience: g.total_years_experience ?? "Not stated",
    linkedin_url: null,
    portfolio_links: [],
    career_pattern:
      signals.company_progression ||
      (career_types_sequence.length > 0
        ? career_types_sequence.join(" → ")
        : "Not available"),
    career_types_sequence,
    shows_product_progression: !!signals.shows_product_progression,
    professional_summary: g.professional_summary ?? "",
    resume_quality: buildResumeQuality(signals),
    ownership_ratio_percent: levelToRatio(signals.ownership_level),
    quantification_ratio_percent: levelToRatio(signals.quantification_level),
    quantification_level: levelToQuantLabel(signals.quantification_level),
    keyword_stuffing_flagged: !!signals.keyword_risk,
    keyword_stuffing_explanation: signals.keyword_risk_explanation ?? "",
    trajectory_velocity: toTrajectoryVelocity(signals.career_trajectory),
    positive_signals,
    watch_signals: watch_signals.slice(0, 2),
    experience,
    experience_fallback_raw: null,
    education,
    skills_verified,
    skills_listed_only,
    title_band: null,
    core_strength_primary: null,
    core_strength_secondary: null,
    core_strength_breakdown: {},
    extracted_email: null,
    extracted_phone: null,
    experience_years: null,
  };
}

export function parseProfileJson(
  text: string,
  provider: string,
  modelId: string,
): ParsedResumeProfile {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error(`${provider} (${modelId}) returned empty response`);
  }

  console.log(
    `[profile-extract] ${provider}/${modelId} raw response (${trimmed.length} chars, first 800):`,
    trimmed.slice(0, 800),
  );

  try {
    return parseJsonFromModel(trimmed) as ParsedResumeProfile;
  } catch (parseErr) {
    console.error(
      `[profile-extract] ${provider}/${modelId} JSON.parse failed. Full raw response:`,
      trimmed,
    );
    throw parseErr;
  }
}
