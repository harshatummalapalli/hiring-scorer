"use client";

import { useState } from "react";
import { ChevronDown, Shield } from "lucide-react";
import type { ConfidenceResult } from "@/types/score";

const LEVEL_STYLES = {
  high: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: "text-emerald-600",
  },
  medium: {
    badge: "border-amber-200 bg-amber-50 text-amber-900",
    icon: "text-amber-600",
  },
  low: {
    badge: "border-slate-200 bg-slate-50 text-slate-700",
    icon: "text-slate-500",
  },
} as const;

const LEVEL_LABELS = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
} as const;

type ConfidenceIndicatorProps = {
  confidence?: ConfidenceResult | null;
};

export function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps) {
  const [open, setOpen] = useState(false);

  if (!confidence) return null;

  const styles = LEVEL_STYLES[confidence.level];
  const hasFactors =
    confidence.factors.positive.length > 0 ||
    confidence.factors.limiting.length > 0;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => hasFactors && setOpen((v) => !v)}
        className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${styles.badge} ${
          hasFactors ? "cursor-pointer hover:opacity-90" : "cursor-default"
        }`}
        aria-expanded={open}
      >
        <Shield className={`h-3 w-3 shrink-0 ${styles.icon}`} aria-hidden />
        <span>{LEVEL_LABELS[confidence.level]}</span>
        {hasFactors && (
          <ChevronDown
            className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        )}
      </button>

      {open && hasFactors && (
        <div className="rounded-lg border border-[#F1F5F9] bg-white px-3 py-2 text-[11px] text-[#475569]">
          {confidence.factors.positive.length > 0 && (
            <ul className="space-y-1">
              {confidence.factors.positive.map((factor) => (
                <li key={factor} className="flex gap-1.5">
                  <span className="text-emerald-600" aria-hidden>
                    +
                  </span>
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
          )}
          {confidence.factors.limiting.length > 0 && (
            <ul
              className={`space-y-1 ${
                confidence.factors.positive.length > 0 ? "mt-2" : ""
              }`}
            >
              {confidence.factors.limiting.map((factor) => (
                <li key={factor} className="flex gap-1.5">
                  <span className="text-slate-400" aria-hidden>
                    –
                  </span>
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
          )}
          {confidence.level === "low" && (
            <p className="mt-2 text-[#64748B]">
              Some signals couldn&apos;t be verified from resume text
            </p>
          )}
        </div>
      )}
    </div>
  );
}
