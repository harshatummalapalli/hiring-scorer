import type { PipelineInsights } from "@/types/pipeline";
import type { CandidateScoreResult } from "@/types/score";
import type { CandidateSignalProfile } from "@/types/candidate";

const INFERRED_PATTERN =
  /^(.+?)\s+inferred from equivalent technology\s*\((.+?)\)\s*(?:[—-].*)?$/i;

function limitWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return words.slice(0, maxWords).join(" ");
}

function shortenEquivalent(term: string): string {
  return term
    .replace(/\barchitectures?\b/gi, "arch")
    .replace(/\btechnologies?\b/gi, "tech")
    .trim();
}

/** Short pipeline insight: direct = skill only; semantic = "Skill via equivalent" (≤5 words). */
export function shortenInsightPhrase(raw: string): string {
  const text = raw.trim();
  if (!text) return "";

  const inferred = INFERRED_PATTERN.exec(text);
  if (inferred) {
    const skill = inferred[1].trim();
    const equiv = shortenEquivalent(inferred[2].trim());
    return limitWords(`${skill} via ${equiv}`, 5);
  }

  const inlineInfer = /inferred from equivalent technology\s*\(([^)]+)\)/i.exec(
    text,
  );
  if (inlineInfer) {
    const skill = text.split(/\s+inferred\b/i)[0]?.trim() ?? text;
    return limitWords(
      `${skill} via ${shortenEquivalent(inlineInfer[1])}`,
      5,
    );
  }

  const viaSplit = /^(.+?)\s+via\s+(.+)$/i.exec(text);
  if (viaSplit) {
    return limitWords(
      `${viaSplit[1].trim()} via ${shortenEquivalent(viaSplit[2].trim())}`,
      5,
    );
  }

  const stripped = text.replace(/\s*[—-]\s*not named.*$/i, "").trim();
  return limitWords(stripped, 5);
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
      const phrase = limitWords(m.skill.trim(), 5);
      if (phrase && !phrases.includes(phrase)) phrases.push(phrase);
    }
  }

  for (const m of intel.matches) {
    if (phrases.length >= 2) break;
    if (m.match_type === "semantic" && m.matched_term?.trim()) {
      const phrase = limitWords(
        `${m.skill.trim()} via ${shortenEquivalent(m.matched_term.trim())}`,
        5,
      );
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
    const phrase = shortenInsightPhrase(item.signal ?? "");
    if (phrase && !signals.includes(phrase)) signals.push(phrase);
    if (signals.length >= 2) break;
  }

  if (signals.length < 2) {
    for (const flag of result.green_flags ?? []) {
      const raw = typeof flag === "string" ? flag : flag.text?.trim();
      if (!raw) continue;
      const phrase = shortenInsightPhrase(raw);
      if (phrase && !signals.includes(phrase)) signals.push(phrase);
      if (signals.length >= 2) break;
    }
  }

  return { signals: signals.slice(0, 2) };
}

export function insightsFromProfile(
  profile: CandidateSignalProfile,
): PipelineInsights {
  const signals = profile.positive_signals
    .map((s) => shortenInsightPhrase(s.signal))
    .filter(Boolean)
    .slice(0, 2);
  return { signals };
}

export function formatInsightsText(insights: PipelineInsights): string {
  return (insights.signals ?? [])
    .map((s) => shortenInsightPhrase(s))
    .filter(Boolean)
    .slice(0, 2)
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
