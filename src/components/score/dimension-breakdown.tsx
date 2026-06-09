"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { DimensionConsensusDetail, DimensionKey } from "@/types/score";
import { confidenceBadgeClass, toRecruiterConfidenceLabel } from "@/lib/scoring/recruiter-labels";
import { DIMENSION_LABELS } from "@/types/score";

type DimensionBreakdownProps = {
  dimensionKey: DimensionKey;
  detail: DimensionConsensusDetail;
  displayScore: number;
  isProvisional: boolean;
  weight: number;
};

export function DimensionBreakdown({
  dimensionKey,
  detail,
  displayScore,
  isProvisional,
  weight,
}: DimensionBreakdownProps) {
  const [open, setOpen] = useState(false);
  const gptCell = detail.model_details.gpt4o;

  return (
    <li className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-900">
              {DIMENSION_LABELS[dimensionKey]}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${confidenceBadgeClass(toRecruiterConfidenceLabel(detail.dimension_confidence_label))}`}
            >
              {toRecruiterConfidenceLabel(detail.dimension_confidence_label)}
            </span>
          </div>
          <p className="mt-1 text-sm tabular-nums text-slate-600">
            {displayScore}
            {isProvisional && (
              <span className="font-semibold text-amber-600">*</span>
            )}
            /100 · weight {weight}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          )}
          {open ? "Hide details" : "Show details"}
        </button>
      </div>

      <div className="h-2 overflow-hidden rounded-b-lg bg-slate-100 mx-4 mb-4 -mt-1">
        <div
          className={`h-full rounded-full transition-all ${
            isProvisional ? "bg-amber-500" : "bg-slate-900"
          }`}
          style={{ width: `${displayScore}%` }}
        />
      </div>

      {open && (
        <div className="border-t border-slate-100 px-4 pb-4">
          <dl className="mt-3 grid gap-3 text-xs text-slate-700 sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-500">Score</dt>
              <dd className="mt-0.5 tabular-nums font-semibold text-slate-900">
                {gptCell.score}/100
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold text-slate-500">Assessment</dt>
              <dd className="mt-0.5">{gptCell.reason}</dd>
            </div>
            {gptCell.dimension_flag ? (
              <div className="sm:col-span-2">
                <dt className="font-semibold text-slate-500">Evidence</dt>
                <dd className="mt-0.5 text-slate-600">{gptCell.dimension_flag}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      )}
    </li>
  );
}
