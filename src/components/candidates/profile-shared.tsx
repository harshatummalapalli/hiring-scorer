import type { FitVerdict } from "@/types/score";
import type { ReactNode } from "react";
import { VERDICT_DISPLAY, verdictBadgeClass, verdictLabel, karta } from "@/lib/brand/karta";

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
  compact,
}: {
  verdict: string | null | undefined;
  score?: number | null;
  compact?: boolean;
}) {
  if (!verdict) {
    return (
      <span className={`${karta.badge} bg-slate-200 text-slate-600`}>
        Not matched yet
      </span>
    );
  }
  return (
    <span className={`${karta.badge} ${verdictBadgeClass(verdict)}`}>
      {verdictLabel(verdict)}
      {score != null && !compact ? ` · ${score}` : null}
      {score != null && compact ? ` ${score}` : null}
    </span>
  );
}

/** @deprecated use VerdictBadge */
export const VERDICT_BADGE: Record<
  FitVerdict,
  { text: string; bg: string; ring: string }
> = {
  "STRONG FIT": { text: "text-white", bg: "bg-[#059669]", ring: "ring-transparent" },
  "POSSIBLE FIT": { text: "text-white", bg: "bg-[#D97706]", ring: "ring-transparent" },
  "WEAK FIT": { text: "text-white", bg: "bg-[#64748B]", ring: "ring-transparent" },
  "NOT SUITABLE": { text: "text-white", bg: "bg-[#E11D48]", ring: "ring-transparent" },
};

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
