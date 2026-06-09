"use client";

import { karta } from "@/lib/brand/karta";
import {
  deriveRecommendedAction,
  RECOMMENDED_ACTION_LABELS,
  type RecommendedAction,
} from "@/lib/scoring/recommended-action";
import type { CandidateScoreResult } from "@/types/score";

const ACTION_STYLES: Record<
  RecommendedAction,
  { bg: string; border: string; text: string; dot: string }
> = {
  interview: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-800",
    dot: "bg-emerald-500",
  },
  hold: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-900",
    dot: "bg-amber-500",
  },
  reject: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    dot: "bg-red-500",
  },
};

type RecommendedActionSectionProps = {
  result: CandidateScoreResult;
  overallScore?: number;
};

export function RecommendedActionSection({
  result,
  overallScore,
}: RecommendedActionSectionProps) {
  const recommendation = deriveRecommendedAction(result);
  const styles = ACTION_STYLES[recommendation.action];
  const score = overallScore ?? result.overall_score;

  return (
    <section
      className={`rounded-xl border ${styles.border} ${styles.bg} p-5`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={karta.sectionHeading}>Recommended action</p>
          <p className={`mt-2 text-2xl font-semibold ${styles.text}`}>
            {RECOMMENDED_ACTION_LABELS[recommendation.action]}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
            Confidence
          </p>
          <p className="mt-1 text-sm font-semibold capitalize text-[#1E293B]">
            {recommendation.confidence}
          </p>
          <p className="mt-2 text-xs text-[#64748B]">
            Score {score}{" "}
            <span className="text-[#94A3B8]">· expandable in Analysis</span>
          </p>
        </div>
      </div>

      {recommendation.reasons.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            Why
          </p>
          <ul className="mt-2 space-y-1.5">
            {recommendation.reasons.map((reason, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-[#334155]"
              >
                <span
                  className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${styles.dot}`}
                />
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {recommendation.risks.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            Risk
          </p>
          <ul className="mt-2 space-y-1.5">
            {recommendation.risks.map((risk, i) => (
              <li key={i} className="text-sm text-[#64748B]">
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
