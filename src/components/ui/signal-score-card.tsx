"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { karta } from "@/lib/brand/karta";

type SignalScoreCardProps = {
  label: string;
  score: number;
  wordLabel: string;
  why: string;
  animate: boolean;
  delayMs?: number;
};

/** Bar width matches the displayed 1–10 score. */
function scoreToBarPercent(score: number): number {
  return Math.min(100, Math.max(0, score * 10));
}

function scoreBadgeClasses(score: number): string {
  if (score >= 8) {
    return "text-emerald-700 bg-emerald-50 border-emerald-200";
  }
  if (score >= 6) {
    return "text-teal-700 bg-teal-50 border-teal-200";
  }
  if (score >= 4) {
    return "text-amber-700 bg-amber-50 border-amber-200";
  }
  return "text-red-700 bg-red-50 border-red-200";
}

export function SignalScoreCard({
  label,
  score,
  wordLabel,
  why,
  animate,
  delayMs = 0,
}: SignalScoreCardProps) {
  const [showWordLabel, setShowWordLabel] = useState(!animate);
  const [whyOpen, setWhyOpen] = useState(false);
  const width = scoreToBarPercent(score);
  const tone = scoreBadgeClasses(score);

  useEffect(() => {
    if (!animate) {
      setShowWordLabel(true);
      return;
    }
    setShowWordLabel(false);
    setWhyOpen(false);
    const t = window.setTimeout(() => setShowWordLabel(true), delayMs + 600);
    return () => window.clearTimeout(t);
  }, [animate, delayMs, score]);

  const barStyle: CSSProperties = animate
    ? {
        ["--bar-width" as string]: `${width}%`,
        animationDelay: `${delayMs}ms`,
      }
    : { width: `${width}%` };

  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-[#334155]">{label}</span>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}
        >
          {score}/10
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className={`min-w-0 flex-1 ${karta.barTrack}`}>
          <div
            className={`${karta.barFill} ${animate ? "insight-bar-fill" : ""}`}
            style={barStyle}
          />
        </div>
        <span
          className={`shrink-0 text-xs font-semibold ${tone} ${
            showWordLabel ? "insight-rating-fade" : "opacity-0"
          }`}
        >
          {wordLabel}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setWhyOpen((o) => !o)}
        className="mt-2 inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[11px] text-[#94A3B8] hover:text-[#64748B]"
      >
        {whyOpen ? (
          <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" aria-hidden />
        )}
        Why this score
      </button>

      <div
        className="overflow-hidden transition-[max-height] duration-200 ease-out"
        style={{ maxHeight: whyOpen ? "12rem" : "0" }}
      >
        <p className="pb-1 pt-2 text-[12px] leading-relaxed text-[#64748B]">
          {why}
        </p>
      </div>
    </div>
  );
}
