import type { PipelineInsights } from "@/types/pipeline";
import type { CandidateScoreResult } from "@/types/score";
import type { CandidateSignalProfile } from "@/types/candidate";

const INFERRED_PATTERN =
  /^(.+?)\s+inferred from equivalent technology\s*(?:\(([^)]+)\)|via\s+(.+?))(?:\s*[—-].*)?$/i;

const LEADING_FILLER =
  /^(?:excellent|strong|proven|solid|deep|good|relevant|hands-on|extensive|significant|demonstrated|clear)\s+/i;

/** Max four words for pipeline insight chips (first noun phrase). */
export function shortenInsightToNounPhrase(raw: string): string {
  const text = raw.trim();
  if (!text) return "";

  const inferred = INFERRED_PATTERN.exec(text);
  if (inferred) {
    const skill = inferred[1]
      .trim()
      .replace(/\s+Technologies?$/i, "")
      .split(/\s+/)
      .slice(0, 2)
      .join(" ");
    const equiv = (inferred[2] ?? inferred[3] ?? "").trim();
    return limitWords(`${skill} via ${equiv}`, 4);
  }

  const viaShort = /^(.+?)\s+via\s+(.+)$/i.exec(text);
  if (viaShort && viaShort[1].split(/\s+/).length <= 3) {
    return limitWords(
      `${viaShort[1].trim()} via ${viaShort[2].trim()}`,
      4,
    );
  }

  const withObject = /\bwith\s+(.+?)(?:\.|,|;|$)/i.exec(text);
  if (withObject) {
    const chunk = withObject[1]
      .replace(/\s+solutions?$/i, "")
      .replace(/\s+experience$/i, " experience")
      .trim();
    const phrase = takeNounPhrase(chunk, 4);
    if (phrase) return phrase;
  }

  const stripped = text
    .replace(/\s*[—-]\s*not named.*$/i, "")
    .replace(LEADING_FILLER, "")
    .trim();
  return takeNounPhrase(stripped, 4);
}

function takeNounPhrase(text: string, maxWords: number): string {
  const filler = new Set([
    "excellent",
    "strong",
    "proven",
    "solid",
    "deep",
    "good",
    "relevant",
    "hands-on",
    "extensive",
    "significant",
    "demonstrated",
    "clear",
    "the",
    "a",
    "an",
    "and",
    "or",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "from",
    "their",
    "this",
    "that",
    "has",
    "have",
    "had",
    "is",
    "are",
    "was",
    "were",
    "experience",
    "background",
    "skills",
    "skill",
  ]);

  const words = text.trim().split(/\s+/).filter(Boolean);
  const kept: string[] = [];
  for (const w of words) {
    if (kept.length >= maxWords) break;
    if (filler.has(w.toLowerCase()) && kept.length === 0) continue;
    kept.push(w);
  }
  return kept.join(" ");
}

function limitWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return words.slice(0, maxWords).join(" ");
}

function phraseFromSkillsIntelligence(
  result: CandidateScoreResult,
): string[] {
  const intel = result.skills_intelligence;
  if (!intel?.matches?.length) return [];

  const phrases: string[] = [];

  for (const m of intel.matches) {
    if (phrases.length >= 2) break;
    if (m.match_type === "direct") {
      const phrase = shortenInsightToNounPhrase(m.skill.trim());
      if (phrase && !phrases.includes(phrase)) phrases.push(phrase);
    }
  }

  for (const m of intel.matches) {
    if (phrases.length >= 2) break;
    if (m.match_type === "semantic" && m.matched_term?.trim()) {
      const raw = `${m.skill.trim()} inferred from equivalent technology (${m.matched_term.trim()})`;
      const phrase = shortenInsightToNounPhrase(raw);
      if (phrase && !phrases.includes(phrase)) phrases.push(phrase);
    }
  }

  return phrases;
}

export function insightsFromScoreResult(
  result: CandidateScoreResult | null | undefined,
): PipelineInsights {
  if (!result) return { signals: [] };

  const fromSkills = phraseFromSkillsIntelligence(result);
  if (fromSkills.length >= 2) {
    return { signals: fromSkills.slice(0, 2) };
  }

  const signals = [...fromSkills];

  for (const item of result.recruiter_card?.what_stands_out ?? []) {
    const phrase = shortenInsightToNounPhrase(item.signal ?? "");
    if (phrase && !signals.includes(phrase)) signals.push(phrase);
    if (signals.length >= 2) break;
  }

  if (signals.length < 2) {
    for (const flag of result.green_flags ?? []) {
      const raw = typeof flag === "string" ? flag : flag.text?.trim();
      if (!raw) continue;
      const phrase = shortenInsightToNounPhrase(raw);
      if (phrase && !signals.includes(phrase)) signals.push(phrase);
      if (signals.length >= 2) break;
    }
  }

  return {
    signals: signals.slice(0, 2).map((s) => shortenInsightToNounPhrase(s)),
  };
}

export function insightsFromProfile(
  profile: CandidateSignalProfile,
): PipelineInsights {
  const signals = profile.positive_signals
    .map((s) => shortenInsightToNounPhrase(s.signal))
    .filter(Boolean)
    .slice(0, 2);
  return { signals };
}

export function formatInsightsText(insights: PipelineInsights): string {
  return (insights.signals ?? [])
    .slice(0, 2)
    .map((s) => shortenInsightToNounPhrase(s))
    .filter(Boolean)
    .join(" · ");
}

export function topWatchPoint(result: CandidateScoreResult | null): string {
  if (!result) return "";
  const card = result.recruiter_card;
  if (card?.worth_exploring?.[0]) return card.worth_exploring[0];
  for (const w of result.watch_signals ?? []) {
    const text = typeof w === "string" ? w : w.text?.trim();
    if (text) return text;
  }
  return "";
}
