"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { DimensionConsensusDetail, DimensionKey } from "@/types/score";
import { DIMENSION_LABELS } from "@/types/score";

function confidenceStyles(label: string) {
  if (label === "High Confidence") return "bg-emerald-100 text-emerald-800";
  if (label === "Medium Confidence") return "bg-amber-100 text-amber-800";
  if (label === "Review Recommended") return "bg-red-100 text-red-800";
  return "bg-slate-100 text-slate-700";
}

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

  return (
    <li className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-900">
              {DIMENSION_LABELS[dimensionKey]}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${confidenceStyles(detail.dimension_confidence_label)}`}
            >
              {detail.dimension_confidence_label}
            </span>
          </div>
          <p className="mt-1 text-sm tabular-nums text-slate-600">
            Consensus {displayScore}
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
                <ModelRow
                  name="Gemini Flash (Signal Extractor)"
                  cell={m.gemini}
                />
                <ModelRow
                  name="Claude (Devil's Advocate)"
                  cell={m.claude}
                />
                <ModelRow
                  name="GPT-4o (Structured Scorer)"
                  cell={m.gpt4o}
                />
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200">
                  <td className="py-2 pr-3 font-medium text-slate-800">Spread</td>
                  <td colSpan={3} className="py-2 tabular-nums">
                    {detail.spread} points (high {Math.max(m.gpt4o.score, m.claude.score, m.gemini.score)} − low{" "}
                    {Math.min(m.gpt4o.score, m.claude.score, m.gemini.score)})
                  </td>
                </tr>
                <tr>
                  <td className="pb-2 pr-3 font-medium text-slate-800">
                    Dimension confidence
                  </td>
                  <td colSpan={3} className="pb-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${confidenceStyles(detail.dimension_confidence_label)}`}
                    >
                      {detail.dimension_confidence_label}
                    </span>
                    <span className="ml-2 text-slate-500">
                      (≤10 pts = High · two agree = Medium · all diverge = Review)
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
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
