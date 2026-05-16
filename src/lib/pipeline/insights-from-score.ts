import type { PipelineInsights } from "@/types/pipeline";
import type { CandidateScoreResult } from "@/types/score";
import type { CandidateSignalProfile } from "@/types/candidate";

export function insightsFromScoreResult(
  result: CandidateScoreResult | null | undefined,
): PipelineInsights {
  const signals: string[] = [];
  if (!result) return { signals };

  for (const item of result.recruiter_card?.what_stands_out ?? []) {
    const text = item.signal?.trim();
    if (text && !signals.includes(text)) signals.push(text);
    if (signals.length >= 2) break;
  }

  if (signals.length < 2) {
    for (const flag of result.green_flags ?? []) {
      const text = typeof flag === "string" ? flag : flag.text?.trim();
      if (text && !signals.includes(text)) signals.push(text);
      if (signals.length >= 2) break;
    }
  }

  return { signals: signals.slice(0, 2) };
}

export function insightsFromProfile(
  profile: CandidateSignalProfile,
): PipelineInsights {
  const signals = profile.positive_signals
    .map((s) => s.signal.trim())
    .filter(Boolean)
    .slice(0, 2);
  return { signals };
}

export function formatInsightsText(insights: PipelineInsights): string {
  return (insights.signals ?? []).filter(Boolean).slice(0, 2).join(" · ");
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
