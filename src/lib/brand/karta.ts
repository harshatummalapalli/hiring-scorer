import type { FitVerdict } from "@/types/score";

export const KARTA = {
  name: "Karta",
  tagline: "The Agent That Sees Beyond the Resume",
} as const;

/** Recruiter-facing verdict labels (internal FitVerdict strings unchanged). */
/** Shared verdict pill: 4px 12px padding, 12px/600, 20px radius — background only varies. */
export const VERDICT_BADGE_BASE =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[20px] px-3 py-1 text-[12px] font-semibold leading-none text-white";

export const VERDICT_BADGE_UNMATCHED = `${VERDICT_BADGE_BASE} bg-slate-200 !text-slate-600`;

export const VERDICT_DISPLAY: Record<
  FitVerdict,
  { label: string; badgeClass: string }
> = {
  "STRONG FIT": {
    label: "Strong Match",
    badgeClass: "bg-[#059669]",
  },
  "POSSIBLE FIT": {
    label: "Potential Match",
    badgeClass: "bg-[#D97706]",
  },
  "WEAK FIT": {
    label: "Low Match",
    badgeClass: "bg-[#64748B]",
  },
  "NOT SUITABLE": {
    label: "No Match",
    badgeClass: "bg-[#E11D48]",
  },
};

export function verdictLabel(verdict: string | null | undefined): string {
  if (!verdict) return "Not matched yet";
  return (
    VERDICT_DISPLAY[verdict as FitVerdict]?.label ?? "Not matched yet"
  );
}

export function verdictBadgeClass(verdict: string | null | undefined): string {
  if (!verdict) {
    return "bg-slate-200";
  }
  return (
    VERDICT_DISPLAY[verdict as FitVerdict]?.badgeClass ?? "bg-slate-200"
  );
}

/** Shared Tailwind fragments */
export const karta = {
  nav: "bg-[#1E293B] text-white",
  page: "bg-[#F8FAFC]",
  card: "rounded-lg border border-[#F1F5F9] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]",
  heading: "text-[#1E293B] font-semibold",
  body: "text-[#334155]",
  muted: "text-[#64748B]",
  sectionHeading:
    "text-[13px] font-semibold uppercase tracking-[0.05em] text-[#64748B]",
  pageTitle: "text-2xl font-semibold text-[#1E293B]",
  btnPrimary:
    "rounded-md bg-[#0D9488] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0B8276] disabled:opacity-50",
  btnSecondary:
    "rounded-md border border-[#1E293B] bg-white px-4 py-2 text-sm font-semibold text-[#1E293B] hover:bg-slate-50 disabled:opacity-50",
  btnOutlineTeal:
    "rounded-md border border-[#0D9488] bg-white px-4 py-2 text-sm font-semibold text-[#0D9488] hover:bg-teal-50 disabled:opacity-50",
  input:
    "rounded-md border border-slate-300 bg-white px-3 py-2 text-[15px] text-[#334155] focus:border-[#0D9488] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30",
  barTrack: "h-2 rounded-md bg-[#E2E8F0] overflow-hidden",
  barFill: "h-full rounded-md bg-[#0D9488]",
  badge: VERDICT_BADGE_BASE,
} as const;

export const VERDICT_SORT_ORDER: Record<FitVerdict, number> = {
  "STRONG FIT": 0,
  "POSSIBLE FIT": 1,
  "WEAK FIT": 2,
  "NOT SUITABLE": 3,
};
