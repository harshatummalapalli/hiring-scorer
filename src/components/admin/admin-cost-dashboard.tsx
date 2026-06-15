"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import type { OperationalCostsSnapshot } from "@/lib/admin/operational-cost-queries";

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(n);
}

function modelLabel(model: string): string {
  if (model.includes("gemini")) return "Gemini Parse";
  if (model.includes("gpt-4o-mini")) return "GPT Scoring";
  if (model.includes("claude")) return "Claude Analysis";
  return model;
}

function CostCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#1E2230] bg-[#111420] p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-semibold tabular-nums ${
          accent ? "text-emerald-400" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function AdminCostDashboard() {
  const [data, setData] = useState<OperationalCostsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/costs", { cache: "no-store" });
      if (res.status === 404) {
        setError("Not found");
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load costs");
      setData(json as OperationalCostsSnapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load costs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const maxDailyCost = Math.max(
    ...(data?.last7days.dailyBreakdown.map((d) => d.cost) ?? [0]),
    0.000001,
  );

  return (
    <div className="rounded-2xl border border-[#1E2230] bg-[#0B0D14] p-6 text-[#E2E8F0]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">LLM Costs</h2>
          <p className="mt-1 text-xs text-[#64748B]">
            Per-call token usage from operational events
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-[#4F46E5]/40 bg-[#111420] px-3 py-2 text-sm font-medium text-[#A5B4FC] hover:border-[#4F46E5] hover:text-white disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </button>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#4F46E5]" />
        </div>
      ) : data ? (
        <div className="mt-6 space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <CostCard label="Today" value={formatUsd(data.today.total)} />
            <CostCard
              label="This week (7 days)"
              value={formatUsd(data.last7days.total)}
            />
            <CostCard
              label="Cache savings today"
              value={formatUsd(data.today.cacheSavings)}
              accent
            />
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300/80">
                Caching
              </p>
              <p className="mt-2 text-sm font-medium text-emerald-300">
                Saved {formatUsd(data.today.cacheSavings)} via caching today
              </p>
            </div>
          </div>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[#94A3B8]">
              By model (today)
            </h3>
            <div className="mt-3 overflow-x-auto rounded-xl border border-[#1E2230] bg-[#111420]">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-[#1E2230] text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  <tr>
                    <th className="px-4 py-3">Model</th>
                    <th className="px-4 py-3 text-right">Cost</th>
                    <th className="px-4 py-3 text-right">Calls</th>
                    <th className="px-4 py-3 text-right">Avg / call</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2230]">
                  {data.today.byModel.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-[#64748B]"
                      >
                        No billed LLM calls today.
                      </td>
                    </tr>
                  ) : (
                    data.today.byModel.map((row) => (
                      <tr key={row.model} className="hover:bg-[#151925]">
                        <td className="px-4 py-3 font-medium text-white">
                          {modelLabel(row.model)}
                          <span className="mt-0.5 block text-xs font-normal text-[#64748B]">
                            {row.model}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#E2E8F0]">
                          {formatUsd(row.cost)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#94A3B8]">
                          {row.calls}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#94A3B8]">
                          {formatUsd(row.calls > 0 ? row.cost / row.calls : 0)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[#94A3B8]">
              By workspace (today)
            </h3>
            <div className="mt-3 overflow-x-auto rounded-xl border border-[#1E2230] bg-[#111420]">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b border-[#1E2230] text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                  <tr>
                    <th className="px-4 py-3">Workspace</th>
                    <th className="px-4 py-3 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2230]">
                  {data.today.byWorkspace.length === 0 ? (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-4 py-8 text-center text-[#64748B]"
                      >
                        No workspace-attributed costs today.
                      </td>
                    </tr>
                  ) : (
                    data.today.byWorkspace.map((row) => (
                      <tr key={row.workspaceId} className="hover:bg-[#151925]">
                        <td className="px-4 py-3 font-medium text-white">
                          {row.workspaceName}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#E2E8F0]">
                          {formatUsd(row.cost)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[#94A3B8]">
              7-day trend
            </h3>
            <div className="mt-4 flex h-40 items-end gap-2 rounded-xl border border-[#1E2230] bg-[#111420] px-4 pb-4 pt-6">
              {data.last7days.dailyBreakdown.map((day) => {
                const heightPct = Math.max(
                  4,
                  (day.cost / maxDailyCost) * 100,
                );
                return (
                  <div
                    key={day.date}
                    className="flex min-w-0 flex-1 flex-col items-center gap-2"
                  >
                    <span className="text-[10px] tabular-nums text-[#64748B]">
                      {day.cost > 0 ? formatUsd(day.cost) : "—"}
                    </span>
                    <div
                      className="w-full max-w-[48px] rounded-t bg-[#4F46E5]"
                      style={{ height: `${heightPct}%` }}
                      title={`${day.date}: ${formatUsd(day.cost)}`}
                    />
                    <span className="text-[10px] text-[#64748B]">
                      {day.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
