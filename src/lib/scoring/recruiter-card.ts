import type {
  CandidateHeader,
  CompanyType,
  FitVerdict,
  RecruiterCard,
  StandoutBullet,
  WorkHistoryEntry,
} from "@/types/score";
import type {
  DevilsAdvocateResult,
  SignalExtractorResult,
} from "@/lib/ai/legacy-model-types";
import { normalizeInterviewQuestions } from "@/lib/scoring/interview-questions";

const COMPANY_TYPES: CompanyType[] = [
  "Services",
  "Product",
  "GCC",
  "Startup",
];

import { displayNameFromFilename } from "@/lib/candidates/extract-resume-header";

export function filenameToDisplayName(filename: string): string {
  return displayNameFromFilename(filename);
}

export function scoreToVerdict(score: number): FitVerdict {
  if (score >= 75) return "STRONG FIT";
  if (score >= 55) return "POSSIBLE FIT";
  if (score >= 35) return "WEAK FIT";
  return "NOT SUITABLE";
}

export function verdictTone(
  verdict: FitVerdict,
): "green" | "amber" | "orange" | "red" {
  switch (verdict) {
    case "STRONG FIT":
      return "green";
    case "POSSIBLE FIT":
      return "amber";
    case "WEAK FIT":
      return "orange";
    default:
      return "red";
  }
}

function normalizeForQuoteMatch(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

export function quoteExistsInResume(quote: string, resumeText: string): boolean {
  const q = quote.trim();
  if (!q || q.length < 8) return false;

  const normalizedResume = normalizeForQuoteMatch(resumeText);
  const normalizedQuote = normalizeForQuoteMatch(q);

  if (normalizedResume.includes(normalizedQuote)) return true;

  const words = normalizedQuote.split(" ").filter((w) => w.length > 2);
  if (words.length < 4) return false;

  let hits = 0;
  for (const word of words) {
    if (normalizedResume.includes(word)) hits += 1;
  }
  return hits / words.length >= 0.85;
}

export function formatCareerPattern(entries: WorkHistoryEntry[]): string {
  const types = entries
    .map((e) => e.type)
    .filter((t): t is CompanyType => COMPANY_TYPES.includes(t));

  if (types.length === 0) return "Not available";
  if (types.length === 1) return types[0];

  return types.join(" → ");
}

function parseCompanyType(value: unknown): CompanyType | null {
  const v = String(value ?? "").trim();
  if ((COMPANY_TYPES as string[]).includes(v)) return v as CompanyType;
  return null;
}

function parseWorkHistory(value: unknown): WorkHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item !== "object" || item == null) return null;
      const o = item as Record<string, unknown>;
      const company = String(o.company ?? "").trim();
      const type = parseCompanyType(o.type);
      if (!company || !type) return null;
      return { company, type };
    })
    .filter((x): x is WorkHistoryEntry => x != null);
}

function formatYearsExperience(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.round(value * 10) / 10;
    return `${rounded} years`;
  }
  const s = String(value ?? "").trim();
  if (!s) return "Not stated";
  if (/\byear/i.test(s)) return s;
  const n = Number(s);
  if (!Number.isNaN(n)) return `${n} years`;
  return s;
}

export function buildRecruiterCard(
  candidateFilename: string,
  resumeText: string,
  signalExtractor: SignalExtractorResult,
  devilsAdvocate: DevilsAdvocateResult,
  worthExploringCandidates: string[],
): RecruiterCard {
  const profile = signalExtractor.candidate_profile;

  const workHistory = parseWorkHistory(profile?.work_history);
  const career_pattern =
    typeof profile?.career_pattern === "string" && profile.career_pattern.trim()
      ? profile.career_pattern.trim()
      : formatCareerPattern(workHistory);

  const candidate_header: CandidateHeader = {
    display_name: filenameToDisplayName(candidateFilename),
    most_recent_title:
      String(profile?.most_recent_title ?? "").trim() || "Not stated",
    total_years_experience: formatYearsExperience(
      profile?.total_years_experience,
    ),
    career_pattern,
  };

  const what_stands_out: StandoutBullet[] = [];
  for (const flag of signalExtractor.green_flags) {
    if (what_stands_out.length >= 3) break;
    const evidence = flag.evidence_quote?.trim() ?? "";
    if (!evidence || !quoteExistsInResume(evidence, resumeText)) continue;
    what_stands_out.push({
      signal: flag.text.trim(),
      evidence,
    });
  }

  const worth_exploring = worthExploringCandidates
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((text, i, arr) => arr.indexOf(text) === i)
    .slice(0, 2);

  let interview_questions = normalizeInterviewQuestions(
    devilsAdvocate.interview_questions,
  );

  while (interview_questions.length < 2) {
    const gap = worth_exploring[interview_questions.length];
    interview_questions.push(
      gap
        ? normalizeInterviewQuestions([
            `Can you walk me through how you would address: ${gap}`,
          ])[0]
        : "What would you want us to understand about your experience that is not obvious from your resume?",
    );
  }

  return {
    candidate_header,
    what_stands_out,
    worth_exploring,
    interview_questions,
  };
}

export function buildFallbackRecruiterCard(
  candidateFilename: string,
  worthExploring: string[],
  interviewQuestions: string[],
): RecruiterCard {
  const questions = interviewQuestions.slice(0, 2);
  while (questions.length < 2) {
    questions.push(
      "What would you want us to understand about your experience that is not obvious from your resume?",
    );
  }

  return {
    candidate_header: {
      display_name: filenameToDisplayName(candidateFilename),
      most_recent_title: "Not stated",
      total_years_experience: "Not stated",
      career_pattern: "Not available",
    },
    what_stands_out: [],
    worth_exploring: worthExploring.slice(0, 2),
    interview_questions: questions,
  };
}
