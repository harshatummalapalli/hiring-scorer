import type { FitVerdict } from "@/types/score";

export const KARTA = {
  name: "Karta",
  tagline: "The Agent That Sees Beyond the Resume",
} as const;

export const VERDICT_BADGE_BASE =
  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[20px] px-3 py-1 text-[12px] font-medium leading-none text-white";

export const VERDICT_BADGE_UNMATCHED = `${VERDICT_BADGE_BASE} bg-slate-200 !text-slate-600`;

export const VERDICT_BADGE_SHADOW: Partial<Record<FitVerdict, string>> = {
  "STRONG FIT": "shadow-[0_0_0_3px_rgba(5,150,105,0.15)]",
  "POSSIBLE FIT": "shadow-[0_0_0_3px_rgba(217,119,6,0.15)]",
};

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
  return VERDICT_DISPLAY[verdict as FitVerdict]?.label ?? "Not matched yet";
}

export function verdictBadgeClass(verdict: string | null | undefined): string {
  if (!verdict) {
    return "bg-slate-200";
  }
  return VERDICT_DISPLAY[verdict as FitVerdict]?.badgeClass ?? "bg-slate-200";
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
    "rounded-[10px] border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] transition-[box-shadow,border-color] duration-150 ease-out",
  cardHover:
    "hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:border-[rgba(13,148,136,0.3)]",
  cardClickable:
    "cursor-pointer rounded-[10px] border border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] transition-[box-shadow,border-color] duration-150 ease-out hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:border-[rgba(13,148,136,0.3)] cursor-pointer",
  heading: "text-[#1E293B] font-semibold leading-[1.2]",
  body: "text-[15px] font-normal text-[#334155] leading-[1.5]",
  muted: "text-[13px] font-normal text-[#64748B] leading-[1.5]",
  sectionHeading:
    "text-[13px] font-semibold uppercase tracking-[0.06em] text-[#64748B] leading-[1.2]",
  pageTitle: "text-[24px] font-semibold text-[#1E293B] leading-[1.2]",
  cardTitle: "text-[16px] font-semibold text-[#1E293B] leading-[1.2]",
  badge: "text-[12px] font-medium leading-[1.2]",
  btnPrimary:
    "btn-press rounded-md bg-[#0D9488] px-4 py-2 text-[15px] font-semibold text-white transition hover:bg-[#0B8276] disabled:opacity-50 disabled:pointer-events-none",
  btnSecondary:
    "btn-press rounded-md border border-[#1E293B] bg-white px-4 py-2 text-[15px] font-semibold text-[#1E293B] transition hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none",
  btnOutlineTeal:
    "btn-press rounded-md border border-[#0D9488] bg-white px-4 py-2 text-[15px] font-semibold text-[#0D9488] transition hover:bg-teal-50 disabled:opacity-50 disabled:pointer-events-none",
  input:
    "rounded-md border border-[#E2E8F0] bg-white px-3 py-2 text-[15px] text-[#334155] leading-[1.5] focus:border-[#0D9488] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/30",
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
  "STRONG FIT": 0,
  "POSSIBLE FIT": 1,
  "WEAK FIT": 2,
  "NOT SUITABLE": 3,
};
