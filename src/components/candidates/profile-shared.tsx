import type { FitVerdict } from "@/types/score";
import type { ReactNode } from "react";
import {
  VERDICT_BADGE_BASE,
  VERDICT_BADGE_UNMATCHED,
  verdictBadgeClass,
  verdictLabel,
  karta,
} from "@/lib/brand/karta";

export function ProfileSection({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${karta.card} p-5 ${className}`}>{children}</section>
  );
}

export function ProfileSectionHeading({ children }: { children: ReactNode }) {
  return <h2 className={`mb-3 ${karta.sectionHeading}`}>{children}</h2>;
}

export function VerdictBadge({
  verdict,
  score,
  showScore,
}: {
  verdict: string | null | undefined;
  score?: number | null;
  /** @deprecated Size is unified; only controls whether the numeric match is shown. */
  compact?: boolean;
  /** Show match score after the label (pipeline table). */
  showScore?: boolean;
}) {
  if (!verdict) {
    return (
      <span className={VERDICT_BADGE_UNMATCHED}>Not matched yet</span>
    );
  }

  return (
    <span className={`${VERDICT_BADGE_BASE} ${verdictBadgeClass(verdict)}`}>
      {verdictLabel(verdict)}
      {score != null && showScore ? ` ${score}` : null}
    </span>
  );
}

export function SignalBar({
  label,
  rating,
  fillPercent,
  note,
}: {
  label: string;
  rating: string;
  fillPercent: number;
  note?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[13px]">
        <span className="font-medium text-[#334155]">{label}</span>
        <span className="font-semibold text-[#1E293B]">{rating}</span>
      </div>
      <div className={karta.barTrack}>
        <div
          className={karta.barFill}
          style={{ width: `${Math.min(100, Math.max(0, fillPercent))}%` }}
        />
      </div>
      {note && <p className="text-xs text-amber-700">{note}</p>}
    </div>
  );
}
