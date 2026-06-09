import type { FitVerdict } from "@/types/score";

export const KARTA = {
  name: "Kharta",
  tagline: "Smart insights. Smarter hires.",
} as const;

export const VERDICT_BADGE_BASE =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[20px] border px-3 py-1 text-[12px] font-semibold leading-none";

export const VERDICT_BADGE_UNMATCHED = `${VERDICT_BADGE_BASE} bg-slate-200 text-slate-600 border-slate-200`;

export const VERDICT_COLORS: Record<
  FitVerdict,
  { bg: string; text: string; border: string }
> = {
  "EXCEPTIONAL MATCH": {
    bg: "bg-gradient-to-r from-violet-50 to-purple-50",
    text: "text-violet-700",
    border: "border-violet-200/80",
  },
  "STRONG MATCH": {
    bg: "bg-gradient-to-r from-emerald-50 to-green-50",
    text: "text-emerald-700",
    border: "border-emerald-200/80",
  },
  "POTENTIAL MATCH": {
    bg: "bg-gradient-to-r from-amber-50 to-yellow-50",
    text: "text-amber-700",
    border: "border-amber-200/80",
  },
  "WEAK MATCH": {
    bg: "bg-gradient-to-r from-orange-50 to-amber-50",
    text: "text-orange-700",
    border: "border-orange-200/80",
  },
  "NOT A MATCH": {
    bg: "bg-gradient-to-r from-red-50 to-rose-50",
    text: "text-red-600",
    border: "border-red-200/80",
  },
};

export const VERDICT_BADGE_SHADOW: Partial<Record<FitVerdict, string>> = {
  "EXCEPTIONAL MATCH": "shadow-[0_0_0_3px_rgba(124,58,237,0.15)]",
  "STRONG MATCH": "shadow-[0_0_0_3px_rgba(5,150,105,0.15)]",
  "POTENTIAL MATCH": "shadow-[0_0_0_3px_rgba(217,119,6,0.15)]",
  "WEAK MATCH": "shadow-[0_0_0_3px_rgba(234,88,12,0.15)]",
  "NOT A MATCH": "shadow-[0_0_0_3px_rgba(220,38,38,0.15)]",
};

export const VERDICT_DISPLAY: Record<
  FitVerdict,
  { label: string; badgeClass: string }
> = {
  "EXCEPTIONAL MATCH": {
    label: "Exceptional Match",
    badgeClass:
      "bg-violet-100 text-violet-800 border border-violet-200",
  },
  "STRONG MATCH": {
    label: "Strong Match",
    badgeClass:
      "bg-emerald-100 text-emerald-800 border border-emerald-200",
  },
  "POTENTIAL MATCH": {
    label: "Potential Match",
    badgeClass:
      "bg-amber-100 text-amber-800 border border-amber-200",
  },
  "WEAK MATCH": {
    label: "Weak Match",
    badgeClass:
      "bg-orange-100 text-orange-800 border border-orange-200",
  },
  "NOT A MATCH": {
    label: "Not a Match",
    badgeClass: "bg-red-100 text-red-700 border border-red-200",
  },
};

export function verdictLabel(verdict: string | null | undefined): string {
  if (!verdict) return "Not matched yet";
  return VERDICT_DISPLAY[verdict as FitVerdict]?.label ?? "Not matched yet";
}

const VERDICT_GRADIENT_CLASS: Record<FitVerdict, string> = {
  "EXCEPTIONAL MATCH": "verdict-badge-exceptional",
  "STRONG MATCH": "verdict-badge-strong",
  "POTENTIAL MATCH": "verdict-badge-potential",
  "WEAK MATCH": "verdict-badge-weak",
  "NOT A MATCH": "verdict-badge-not-a-match",
};

export function verdictBadgeClass(verdict: string | null | undefined): string {
  if (!verdict) return "bg-slate-200 text-slate-600 border-slate-200";
  return VERDICT_GRADIENT_CLASS[verdict as FitVerdict] ?? "bg-slate-200 text-slate-600 border-slate-200";
}

export function verdictBadgeShadow(verdict: string | null | undefined): string {
  if (!verdict) return "";
  return VERDICT_BADGE_SHADOW[verdict as FitVerdict] ?? "";
}

/** Shared Tailwind fragments */
export const karta = {
  nav: "bg-[#1E293B] text-white border-b border-white/[0.08]",
  page: "bg-[#F8FAFC]",
  card:
    "rounded-xl border border-slate-200/60 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-200 ease-out",
  cardHover:
    "hover:shadow-[0_4px_16px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.03)] hover:border-teal-200/60 hover:-translate-y-[1px]",
  cardClickable:
    "cursor-pointer rounded-xl border border-slate-200/60 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all duration-200 ease-out hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:border-teal-200/60 hover:-translate-y-[1px] active:translate-y-0 active:shadow-sm",
  heading: "text-[#1E293B] font-semibold leading-[1.2]",
  body: "text-[15px] font-normal text-[#334155] leading-[1.5]",
  muted: "text-[13px] font-normal text-[#64748B] leading-[1.5]",
  sectionHeading:
    "text-[13px] font-semibold uppercase tracking-[0.06em] text-[#64748B] leading-[1.2]",
  pageTitle: "text-[24px] font-semibold text-[#1E293B] leading-[1.2]",
  cardTitle: "text-[16px] font-semibold text-[#1E293B] leading-[1.2]",
  badge: "text-[12px] font-medium leading-[1.2]",
  btnPrimary:
    "rounded-lg bg-gradient-to-b from-teal-500 to-teal-600 px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all duration-150 hover:from-teal-400 hover:to-teal-500 hover:shadow-[0_2px_8px_rgba(13,148,136,0.25)] active:from-teal-600 active:to-teal-700 disabled:opacity-50 disabled:pointer-events-none",
  btnSecondary:
    "rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[14px] font-semibold text-slate-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-all duration-150 hover:bg-slate-50 hover:border-slate-300 hover:shadow-[0_2px_4px_rgba(0,0,0,0.06)] active:bg-slate-100 disabled:opacity-50 disabled:pointer-events-none",
  btnOutlineTeal:
    "btn-press rounded-md border border-[#0D9488] bg-white px-4 py-2 text-[15px] font-semibold text-[#0D9488] transition hover:bg-teal-50 disabled:opacity-50 disabled:pointer-events-none",
  input:
    "rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] text-slate-700 leading-[1.5] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] placeholder:text-slate-400 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:shadow-[0_0_0_3px_rgba(13,148,136,0.08)] transition-all duration-150",
  barTrack: "h-2 rounded-md bg-[#E2E8F0] overflow-hidden",
  barFill: "h-full rounded-md bg-[#0D9488]",
  accentTealSection: "rounded-[10px] border border-[#E2E8F0] border-l-[3px] border-l-[#0D9488] bg-[#F0FDFA] p-5",
  accentAmberHeader: "bg-[#FFFBEB]",
  accentTealOverview: "rounded-[10px] border border-[#E2E8F0] bg-[#F0FDFA] p-6",
  jobCardActive: "border-l-[3px] border-l-[#0D9488]",
  tableHeadRow:
    "border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-semibold uppercase tracking-[0.06em] text-[#64748B]",
  tableWrap:
    "overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
  filterBar:
    "rounded-[10px] border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
} as const;

export const VERDICT_SORT_ORDER: Record<FitVerdict, number> = {
  "EXCEPTIONAL MATCH": 0,
  "STRONG MATCH": 1,
  "POTENTIAL MATCH": 2,
  "WEAK MATCH": 3,
  "NOT A MATCH": 4,
};
