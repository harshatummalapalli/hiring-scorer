import type { CompanyType, FitVerdict } from "@/types/score";
import type { ReactNode } from "react";

export function ProfileSection({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white p-6 shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}

export function ProfileSectionHeading({
  children,
  icon,
}: {
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
      {icon}
      {children}
    </h2>
  );
}

const COMPANY_DOT: Record<CompanyType, string> = {
  Product: "bg-emerald-500",
  GCC: "bg-blue-500",
  Services: "bg-amber-500",
  Startup: "bg-purple-500",
};

const COMPANY_BADGE: Record<CompanyType, string> = {
  Product: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  GCC: "bg-blue-50 text-blue-800 ring-blue-200",
  Services: "bg-amber-50 text-amber-900 ring-amber-200",
  Startup: "bg-purple-50 text-purple-800 ring-purple-200",
};

export function CompanyTypeBadge({ type }: { type: CompanyType }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${COMPANY_BADGE[type]}`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${COMPANY_DOT[type]}`}
        aria-hidden
      />
      {type}
    </span>
  );
}

export function CompanyLogoPlaceholder({ company }: { company: string }) {
  const initial = (company.trim()[0] ?? "?").toUpperCase();
  const hues = [
    "bg-slate-700",
    "bg-indigo-600",
    "bg-teal-600",
    "bg-rose-600",
    "bg-cyan-700",
  ];
  const idx = company.length % hues.length;
  return (
    <div
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded text-lg font-semibold text-white ${hues[idx]}`}
      aria-hidden
    >
      {initial}
    </div>
  );
}

export const VERDICT_BADGE: Record<
  FitVerdict,
  { text: string; bg: string; ring: string }
> = {
  "STRONG FIT": {
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    ring: "ring-emerald-200",
  },
  "POSSIBLE FIT": {
    text: "text-amber-700",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
  },
  "WEAK FIT": {
    text: "text-orange-700",
    bg: "bg-orange-50",
    ring: "ring-orange-200",
  },
  "NOT SUITABLE": {
    text: "text-red-700",
    bg: "bg-red-50",
    ring: "ring-red-200",
  },
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
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-800">{label}</span>
        <span className="text-slate-600">{rating}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-900 transition-all"
          style={{ width: `${Math.min(100, Math.max(0, fillPercent))}%` }}
        />
      </div>
      {note && <p className="text-xs text-amber-700">{note}</p>}
    </div>
  );
}
