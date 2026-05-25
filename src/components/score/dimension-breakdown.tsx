"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { DimensionConsensusDetail, DimensionKey } from "@/types/score";
import { confidenceBadgeClass, toRecruiterConfidenceLabel } from "@/lib/scoring/recruiter-labels";
import { DIMENSION_LABELS, MODEL_ROLE_LABELS } from "@/types/score";
import { dimensionHasLegacyMultiModel } from "./legacy-multi-model-display";

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
  const { model_details: m } = detail;
  const isLegacyMultiModel = dimensionHasLegacyMultiModel(detail);
  const gptCell = m.gpt4o;

  const legacyModelRows = isLegacyMultiModel
    ? [
        m.gemini
          ? { name: MODEL_ROLE_LABELS.gemini, cell: m.gemini }
          : null,
        m.claude
          ? { name: MODEL_ROLE_LABELS.claude, cell: m.claude }
          : null,
        { name: MODEL_ROLE_LABELS.gpt4o, cell: m.gpt4o },
      ].filter((row): row is { name: string; cell: typeof m.gpt4o } => row != null)
    : [];

  const scoreValues = legacyModelRows.map((row) => row.cell.score);

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
            {isLegacyMultiModel ? "Combined " : ""}
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
          {isLegacyMultiModel ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-semibold">Model</th>
                    <th className="py-2 pr-3 font-semibold">Score</th>
                    <th className="py-2 pr-3 font-semibold">One-line reason</th>
                    <th className="py-2 font-semibold">Flagged for this dimension</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {legacyModelRows.map((row) => (
                    <ModelRow key={row.name} name={row.name} cell={row.cell} />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200">
                    <td className="py-2 pr-3 font-medium text-slate-800">Spread</td>
                    <td colSpan={3} className="py-2 tabular-nums">
                      {detail.spread} points
                      {scoreValues.length > 1
                        ? ` (high ${Math.max(...scoreValues)} − low ${Math.min(...scoreValues)})`
                        : null}
                    </td>
                  </tr>
                  <tr>
                    <td className="pb-2 pr-3 font-medium text-slate-800">
                      Model agreement
                    </td>
                    <td colSpan={3} className="pb-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${confidenceBadgeClass(toRecruiterConfidenceLabel(detail.dimension_confidence_label))}`}
                      >
                        {toRecruiterConfidenceLabel(detail.dimension_confidence_label)}
                      </span>
                      <span className="ml-2 text-slate-500">
                        (≤10 pts = strong agreement · two agree = minor disagreement · all diverge = review)
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
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
                  <dt className="font-semibold text-slate-500">Notes</dt>
                  <dd className="mt-0.5 text-slate-600">{gptCell.dimension_flag}</dd>
                </div>
              ) : null}
            </dl>
          )}
          {detail.dissent && (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <strong>Dissent:</strong> {detail.dissent.modelLabel} scored{" "}
              {detail.dissent.score} — {detail.dissent.reason || "no reason given"}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function ModelRow({
  name,
  cell,
}: {
  name: string;
  cell: { score: number; reason: string; dimension_flag: string };
}) {
  return (
    <tr className="border-b border-slate-100 align-top">
      <td className="py-2.5 pr-3 font-medium text-slate-800">{name}</td>
      <td className="py-2.5 pr-3 tabular-nums font-semibold">{cell.score}</td>
      <td className="py-2.5 pr-3 max-w-[200px]">{cell.reason}</td>
      <td className="py-2.5 text-slate-600">{cell.dimension_flag}</td>
    </tr>
  );
}
