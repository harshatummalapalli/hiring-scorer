import type { FitVerdict, RecruiterCard } from "@/types/score";
import { displayNameFromFilename } from "@/lib/candidates/extract-resume-header";

export function filenameToDisplayName(filename: string): string {
  return displayNameFromFilename(filename);
}

export function scoreToVerdict(score: number): FitVerdict {
  if (score >= 85) return "EXCEPTIONAL MATCH";
  if (score >= 75) return "STRONG MATCH";
  if (score >= 55) return "POTENTIAL MATCH";
  if (score >= 35) return "WEAK MATCH";
  return "NOT A MATCH";
}

export function verdictTone(
  verdict: FitVerdict,
): "violet" | "green" | "amber" | "orange" | "red" {
  switch (verdict) {
    case "EXCEPTIONAL MATCH":
      return "violet";
    case "STRONG MATCH":
      return "green";
    case "POTENTIAL MATCH":
      return "amber";
    case "WEAK MATCH":
      return "orange";
    case "NOT A MATCH":
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
