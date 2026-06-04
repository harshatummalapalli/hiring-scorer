import type { ReactNode } from "react";
import {
  VERDICT_BADGE_BASE,
  VERDICT_BADGE_UNMATCHED,
  verdictBadgeClass,
  verdictBadgeShadow,
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
  animateIn = true,
  preliminary = false,
  scoreAnimate = false,
}: {
  verdict: string | null | undefined;
  score?: number | null;
  compact?: boolean;
  showScore?: boolean;
  /** Play entrance animation when badge mounts with a verdict */
  animateIn?: boolean;
  /** Show "Preliminary" label under the badge (local pre-score before GPT) */
  preliminary?: boolean;
  /** Animate score number when GPT score replaces pre-score */
  scoreAnimate?: boolean;
}) {
  if (!verdict) {
    return (
      <span className={VERDICT_BADGE_UNMATCHED}>Not matched yet</span>
    );
  }

  const shadow = verdictBadgeShadow(verdict);

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span
        className={`${VERDICT_BADGE_BASE} ${verdictBadgeClass(verdict)} ${shadow} inline-flex items-center gap-1.5 ${
          animateIn ? "verdict-badge-enter" : ""
        }`}
      >
        <span className="verdict-label">{verdictLabel(verdict)}</span>
        {score != null && showScore ? (
          <>
            <span className="opacity-50" aria-hidden>
              ·
            </span>
            <span
              key={score}
              className={`verdict-score tabular-nums ${scoreAnimate ? "verdict-score-update" : ""}`}
            >
              {score}
            </span>
          </>
        ) : null}
      </span>
      {preliminary ? (
        <span className="text-[10px] text-slate-400">Preliminary</span>
      ) : null}
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
