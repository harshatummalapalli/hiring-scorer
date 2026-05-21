"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import type { AdminOverview, AdminWorkspaceRow } from "@/lib/admin/queries";
import { AdminCostDashboard } from "@/components/admin/admin-cost-dashboard";
import { ParserUsageWidget } from "@/components/admin/parser-usage-widget";
import { karta } from "@/lib/brand/karta";

function formatStorageBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n);
}

function usageClass(current: number, max: number): string {
  if (max <= 0) return "text-[#64748B]";
  const ratio = current / max;
  if (ratio >= 1) return "font-medium text-red-600";
  if (ratio >= 0.85) return "font-medium text-amber-700";
  return "text-[#64748B]";
}

function formatUsage(current: number, max: number): string {
  return `${current} / ${max}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className={`${karta.card} p-5`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-[#1E293B]">{value}</p>
    </div>
  );
}

function ReparseAllCandidatesCard() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    setProgress("Starting…");
    try {
      let offset = 0;
      let total = 0;
      let done = false;
      let updatedTotal = 0;
      while (!done) {
        const res = await fetch(
          `/api/admin/reparse-candidates?offset=${offset}&limit=25`,
          { method: "POST" },
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Reparse failed");
        total = Number(json.total ?? 0);
        const processed = Number(json.processed ?? 0);
        updatedTotal += Number(json.updatedInBatch ?? 0);
        done = Boolean(json.done);
        offset = processed;
        setProgress(`Reparsed ${processed} of ${total} candidates…`);
        if (!done && (json.batchSize ?? 0) === 0) break;
      }
      setProgress(
        `Done. Reparsed ${total} candidates. Updated ${updatedTotal} display names.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reparse failed");
      setProgress(null);
    } finally {
      setRunning(false);
    }
  };

  return (
    <section
      className={`${karta.card} border-2 border-[#0D9488]/30 bg-gradient-to-br from-[#0D9488]/5 to-white p-6 shadow-sm`}
    >
      <h2 className="text-lg font-semibold text-[#1E293B]">Reparse All Candidates</h2>
      <p className="mt-2 text-sm text-[#64748B]">
        Re-run improved name extraction on every candidate with stored resume text:
        header scan, email fallback, and filename cleanup. Fixes glued or numeric
        display names (e.g. Tushar886, Jimmykrgrd).
      </p>
      {progress && (
        <p className="mt-3 text-sm font-medium text-[#0D9488]">{progress}</p>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={running}
        onClick={() => void run()}
        className={`mt-5 w-full sm:w-auto ${karta.btnPrimary} px-8 py-3 text-base font-semibold`}
      >
        {running ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reparsing…
          </span>
        ) : (
          "Reparse All Candidates"
        )}
      </button>
    </section>
  );
}

export function AdminDashboard() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [workspaces, setWorkspaces] = useState<AdminWorkspaceRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
      const [overviewRes, workspacesRes] = await Promise.all([
        fetch("/api/admin/overview"),
        fetch(`/api/admin/workspaces${params}`),
      ]);
      if (overviewRes.status === 404 || workspacesRes.status === 404) {
        setError("Not found");
        return;
      }
      const overviewJson = await overviewRes.json();
      const workspacesJson = await workspacesRes.json();
      if (!overviewRes.ok) {
        throw new Error(overviewJson.error ?? "Failed to load overview");
      }
      if (!workspacesRes.ok) {
        throw new Error(workspacesJson.error ?? "Failed to load workspaces");
      }
      setOverview(overviewJson as AdminOverview);
      setWorkspaces(
        (workspacesJson.workspaces as AdminWorkspaceRow[]) ?? [],
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load(search);
    }, 300);
    return () => clearTimeout(t);
  }, [search, load]);

  if (loading && !overview) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {error}
      </p>
    );
  }

  return (
    <div className="space-y-10">
      <ReparseAllCandidatesCard />

      <section>
        <h2 className={karta.pageTitle}>Platform overview</h2>
        {overview && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Total workspaces" value={overview.totalWorkspaces} />
            <MetricCard
              label="Active (7 days)"
              value={overview.activeWorkspaces7d}
            />
            <MetricCard
              label="Scores today"
              value={overview.candidatesScoredToday}
            />
            <MetricCard
              label="API calls today"
              value={overview.apiCallsToday}
            />
            <MetricCard
              label="Est. API cost today"
              value={formatUsd(overview.estimatedApiCostTodayUsd)}
            />
            <MetricCard
              label="Resume storage (total)"
              value={formatStorageBytes(overview.totalResumeStorageBytes)}
            />
          </div>
        )}
      </section>

      <ParserUsageWidget />

      <AdminCostDashboard />

      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-[#1E293B]">Workspaces</h2>
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search name, email, company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full pl-9 ${karta.input}`}
            />
          </div>
        </div>

        <div className={`mt-4 overflow-x-auto ${karta.card}`}>
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
              <tr>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Last active</th>
                <th className="px-4 py-3 text-right">Jobs (used / max)</th>
                <th className="px-4 py-3 text-right">Candidates (used / max)</th>
                <th className="px-4 py-3 text-right">Scores</th>
                <th className="px-4 py-3 text-right">Est. cost</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workspaces.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-[#64748B]"
                  >
                    No workspaces match your search.
                  </td>
                </tr>
              ) : (
                workspaces.map((w) => (
                  <tr key={w.userId} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-[#1E293B]">
                      {w.ownerName}
                      {w.companyName ? (
                        <span className="mt-0.5 block text-xs font-normal text-[#64748B]">
                          {w.companyName}
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-[#64748B]">
                      {w.ownerEmail}
                    </td>
                    <td className="px-4 py-3 text-[#64748B]">
                      {formatDate(w.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-[#64748B]">
                      {formatDate(w.lastActiveAt)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${usageClass(w.jobsCount, w.maxJobs)}`}
                    >
                      {formatUsage(w.jobsCount, w.maxJobs)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${usageClass(w.candidatesCount, w.maxCandidates)}`}
                    >
                      {formatUsage(w.candidatesCount, w.maxCandidates)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {w.scoresCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatUsd(w.totalApiCostUsd)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/workspaces/${w.userId}`}
                        className={`inline-block ${karta.btnOutlineTeal} !px-3 !py-1.5`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {loading && (
          <p className="mt-2 flex items-center gap-2 text-xs text-[#64748B]">
            <Loader2 className="h-3 w-3 animate-spin" />
            Updating…
          </p>
        )}
      </section>
    </div>
  );
}
