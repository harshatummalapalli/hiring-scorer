"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { karta } from "@/lib/brand/karta";

type ModelRow = {
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  requests: number;
  cost_usd: number;
};

type CostsPayload = {
  fetchedAt: string;
  openai: {
    total_tokens: number;
    total_cost_usd: number;
    requests: number;
    by_model: ModelRow[];
    live: boolean;
    warning?: string;
    note?: string;
  };
  anthropic: {
    claude_cost_usd: number;
    gpt_mini_recorded_usd: number;
    note: string;
  };
  summary: {
    openai_total_usd: number;
    claude_total_usd: number;
    combined_total_usd: number;
    candidates_scored_this_month: number;
    average_cost_per_candidate_usd: number;
    projected_monthly_usd: number;
  };
  workspaces: {
    userId: string;
    ownerEmail: string;
    candidatesScoredThisMonth: number;
    estimatedApiCostUsd: number;
    storageUsedMb: number;
    lastActiveAt: string | null;
  }[];
  missingEnv?: string[];
};

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Admin cost breakdown — version labels only (no vendor model IDs in UI). */
function costTierLabel(index: number): string {
  return `v${index + 1}`;
}

function CostMetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${karta.card} p-5`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-[#1E293B]">{value}</p>
    </div>
  );
}

export function AdminCostDashboard() {
  const [data, setData] = useState<CostsPayload | null>(null);
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
      setData(json as CostsPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load costs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#1E293B]">Cost Dashboard</h2>
          {data?.fetchedAt && (
            <p className="mt-1 text-xs text-[#94A3B8]">
              Data as of {formatDateTime(data.fetchedAt)}
              {data.openai.live
                ? " · Scoring costs live"
                : " · Cost data cached or unavailable"}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className={`inline-flex items-center gap-2 ${karta.btnOutlineTeal}`}
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
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {data?.openai.note && (
        <p className="text-xs text-[#94A3B8]" role="status">
          {data.openai.note}
        </p>
      )}

      {data?.openai.warning && (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          {data.openai.warning}
        </p>
      )}

      {data?.missingEnv && data.missingEnv.length > 0 && (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#64748B]">
          Missing env: {data.missingEnv.join(", ")}. Add them to .env.local for full
          cost tracking.
        </p>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <CostMetricCard
              label="Scoring costs (this month)"
              value={formatUsd(data.summary.openai_total_usd)}
            />
            <CostMetricCard
              label="Analysis costs (this month)"
              value={formatUsd(data.summary.claude_total_usd)}
            />
            <CostMetricCard
              label="Platform costs"
              value={formatUsd(data.summary.combined_total_usd)}
            />
            <CostMetricCard
              label="Candidates scored"
              value={String(data.summary.candidates_scored_this_month)}
            />
            <CostMetricCard
              label="Avg cost / candidate"
              value={formatUsd(data.summary.average_cost_per_candidate_usd)}
            />
            <CostMetricCard
              label="Projected monthly (run rate)"
              value={formatUsd(data.summary.projected_monthly_usd)}
            />
          </div>

          <p className="text-xs text-[#94A3B8]">
            Scoring: {data.openai.requests.toLocaleString()} requests ·{" "}
            {data.openai.total_tokens.toLocaleString()} tokens
            {data.openai.by_model.length > 0 && (
              <>
                {" "}
                · Tiers:{" "}
                {data.openai.by_model
                  .slice(0, 5)
                  .map((_, i) => costTierLabel(i))
                  .join(", ")}
              </>
            )}
          </p>
          <p className="text-xs text-[#94A3B8]">{data.anthropic.note}</p>

          <div className={`overflow-x-auto ${karta.card}`}>
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th className="px-4 py-3">Owner email</th>
                  <th className="px-4 py-3 text-right">Scored this month</th>
                  <th className="px-4 py-3 text-right">Est. API cost</th>
                  <th className="px-4 py-3 text-right">Storage (MB)</th>
                  <th className="px-4 py-3">Last active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.workspaces.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-[#64748B]">
                      No workspace cost data.
                    </td>
                  </tr>
                ) : (
                  data.workspaces.map((w) => (
                    <tr key={w.userId} className="hover:bg-slate-50/50">
                      <td className="max-w-[240px] truncate px-4 py-3 font-medium text-[#1E293B]">
                        {w.ownerEmail}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {w.candidatesScoredThisMonth}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatUsd(w.estimatedApiCostUsd)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {w.storageUsedMb.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">
                        {formatDate(w.lastActiveAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
