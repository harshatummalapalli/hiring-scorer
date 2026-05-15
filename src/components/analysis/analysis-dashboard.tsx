"use client";

import { Download, RefreshCw } from "lucide-react";
import type { AnalysisFindings } from "@/lib/analysis/compute-findings";
import {
  downloadAnalysisJson,
  FUNCTIONAL_ROLE_LABELS,
  MIN_CANDIDATES,
  MIN_CONFIGURATIONS,
  MIN_RUNS_FOR_RELIABLE,
  MODEL_PROVIDER_LABELS,
} from "@/lib/analysis/compute-findings";

type AnalysisDashboardProps = {
  findings: AnalysisFindings;
  loading?: boolean;
  onRefresh: () => void;
  seedStatus?: string | null;
};

export function AnalysisDashboard({
  findings,
  loading,
  onRefresh,
  seedStatus,
}: AnalysisDashboardProps) {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Configuration analysis
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Compare model role assignments across scenarios using stored scoring
            runs and historical data.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              aria-hidden
            />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => downloadAnalysisJson(findings)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export analysis
          </button>
        </div>
      </div>

      {seedStatus && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
          {seedStatus}
        </p>
      )}

      {findings.hasOverallOnlyRuns && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Some runs only include overall consensus scores (historical entries).
          Configuration ranking and model behaviour use those scores; dimension
          reliability requires live runs with full per-model breakdown.
        </p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Data sufficiency</h2>
        <p
          className={`mt-2 text-sm ${findings.sufficiency.sufficient ? "text-emerald-700" : "text-amber-800"}`}
        >
          {findings.sufficiency.message}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Target: ≥{MIN_RUNS_FOR_RELIABLE} runs, ≥{MIN_CONFIGURATIONS}{" "}
          configurations, ≥{MIN_CANDIDATES} candidates.
        </p>
      </section>

      {findings.recommendation && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6">
          <h2 className="text-sm font-semibold text-emerald-900">
            Recommended optimal configuration
          </h2>
          <p className="mt-2 font-medium text-emerald-950">
            {findings.recommendation.label}
          </p>
          <p className="mt-2 text-sm text-emerald-900">
            {findings.recommendation.reasoning}
          </p>
          <p className="mt-2 text-xs text-emerald-800">
            Expected differentiation gap (historical):{" "}
            {findings.recommendation.expectedDifferentiationGap} points
          </p>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          Configuration ranking (differentiation power)
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Gap between highest and lowest overall consensus score per scenario.
        </p>
        <div className="mt-4 space-y-3">
          {findings.configurationRanking.map((row) => (
            <div key={row.configurationId}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium text-slate-800">
                  #{row.rank} {row.scenarioLabel} — {row.candidateCount}{" "}
                  candidates (gap {row.differentiationGap})
                </span>
                <span className="tabular-nums text-slate-500">
                  {row.lowestOverall}–{row.highestOverall}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-800"
                  style={{
                    width: `${Math.min(100, (row.differentiationGap / Math.max(findings.configurationRanking[0]?.differentiationGap ?? 1, 1)) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-0.5 truncate text-[11px] text-slate-500">
                {row.configurationLabel}
              </p>
            </div>
          ))}
        </div>
        {findings.configurationRanking.length === 0 && (
          <p className="mt-4 text-sm text-slate-500">No configuration data yet.</p>
        )}
        <ConfigRankingTable rows={findings.configurationRanking} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Model behaviour</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Model</th>
                <th className="py-2 pr-3">Avg score</th>
                <th className="py-2 pr-3">Generosity</th>
                <th className="py-2 pr-3">Role stability</th>
                <th className="py-2 pr-3">Best role</th>
                <th className="py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {findings.modelBehaviour.map((row) => (
                <tr key={row.model} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-medium">
                    {MODEL_PROVIDER_LABELS[row.model]}
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{row.overallAverageScore}</td>
                  <td className="py-2 pr-3 capitalize">{row.generosity}</td>
                  <td className="py-2 pr-3 capitalize">{row.roleStability}</td>
                  <td className="py-2 pr-3">
                    {FUNCTIONAL_ROLE_LABELS[row.bestRoleForDifferentiation]} (gap{" "}
                    {row.bestRoleGap})
                  </td>
                  <td className="py-2 text-slate-600">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          Dimension reliability
        </h2>
        <ul className="mt-4 space-y-2">
          {findings.dimensionReliability.map((d) => (
            <li
              key={d.dimension}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
            >
              <span className="font-medium text-slate-800">{d.label}</span>
              <span className="text-slate-600">
                {d.totalRuns > 0 ? (
                  <>
                    {d.agreementRate}% agreement within 10 pts ·{" "}
                    <span
                      className={
                        d.reliability === "high"
                          ? "text-emerald-700"
                          : d.reliability === "medium"
                            ? "text-amber-700"
                            : "text-red-700"
                      }
                    >
                      {d.reliability}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-500">{d.note}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Scoring runs log</h2>
        <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm text-slate-600">
          {findings.entries.map((e) => (
            <li key={e.id} className="flex justify-between gap-2 border-b border-slate-50 py-1">
              <span>
                {e.scenarioLabel} · {e.candidateFilename}
              </span>
              <span className="shrink-0 tabular-nums font-medium text-slate-900">
                {e.overallConsensusScore}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ConfigRankingTable({
  rows,
}: {
  rows: AnalysisFindings["configurationRanking"];
}) {
  if (rows.length === 0) return null;
  return (
    <table className="mt-6 w-full text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-xs text-slate-500">
          <th className="py-2 pr-3">Rank</th>
          <th className="py-2 pr-3">Scenario</th>
          <th className="py-2 pr-3">Configuration</th>
          <th className="py-2 pr-3">Runs</th>
          <th className="py-2 pr-3">Gap</th>
          <th className="py-2">Range</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.configurationId} className="border-b border-slate-100">
            <td className="py-2 pr-3">{r.rank}</td>
            <td className="py-2 pr-3">{r.scenarioLabel}</td>
            <td className="max-w-xs truncate py-2 pr-3" title={r.configurationLabel}>
              {r.configurationLabel}
            </td>
            <td className="py-2 pr-3">{r.runCount}</td>
            <td className="py-2 pr-3 font-medium tabular-nums">
              {r.differentiationGap}
            </td>
            <td className="py-2 tabular-nums text-slate-600">
              {r.lowestOverall}–{r.highestOverall}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
