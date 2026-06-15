"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import type { AdminOverview, AdminWorkspaceRow } from "@/lib/admin/queries";
import { AdminCostDashboard } from "@/components/admin/admin-cost-dashboard";
import { PlatformAnalyticsSection } from "@/components/admin/platform-analytics-section";
import { ResumeParsingWidget } from "@/components/admin/resume-parsing-widget";
import { SystemHealthSection } from "@/components/admin/system-health-section";
import { karta } from "@/lib/brand/karta";

type AdminTab = "overview" | "workspaces" | "costs";

const ADMIN_TABS: { id: AdminTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "workspaces", label: "Workspaces" },
  { id: "costs", label: "Costs" },
];

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

function formatMax(max: number): string {
  return max >= 999999 ? "∞" : max.toLocaleString();
}

function usageClass(current: number, max: number): string {
  if (max >= 999999 || max <= 0) return "text-[#64748B]";
  const ratio = current / max;
  if (ratio >= 1) return "font-medium text-red-600";
  if (ratio >= 0.85) return "font-medium text-amber-700";
  return "text-[#64748B]";
}

function formatUsage(current: number, max: number): string {
  return `${current.toLocaleString()} / ${formatMax(max)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function readJsonResponse<T extends Record<string, unknown>>(
  res: Response,
  fallbackError: string,
): Promise<T> {
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      `${fallbackError} (HTTP ${res.status}: empty response). Check server logs.`,
    );
  }
  if (!contentType.includes("application/json")) {
    throw new Error(
      text.trim().slice(0, 200) ||
        `${fallbackError} (HTTP ${res.status}: non-JSON response).`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${fallbackError}: invalid JSON from server.`);
  }
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

function EmailInboundCard() {
  const [stats, setStats] = useState<{
    configured: boolean;
    received?: number;
    successful?: number;
    failed?: number;
    lastReceived?: string | null;
    queuePending?: number;
    queueFailed?: number;
    queueDone?: number;
  } | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [queueProgress, setQueueProgress] = useState("");

  const loadStats = useCallback(() => {
    void fetch("/api/admin/email-log")
      .then((r) => r.json())
      .then((json) => setStats(json))
      .catch(() => setStats({ configured: false }));
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const retryFailed = async () => {
    setRetrying(true);
    try {
      const res = await fetch("/api/email-process", { method: "GET" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Retry failed");
      loadStats();
    } catch (err) {
      console.error(err);
    } finally {
      setRetrying(false);
    }
  };

  const fetchFromGmail = async () => {
    setFetching(true);
    setQueueProgress("");
    try {
      const res = await fetch("/api/email-fetch", { method: "POST" });
      const json = await readJsonResponse<{
        error?: string;
        fetched?: number;
        queued?: number;
        skippedNoSuffix?: number;
        skippedUnknownJob?: number;
        skippedUpload?: number;
      }>(res, "Gmail fetch failed");
      if (!res.ok) throw new Error(json.error ?? "Fetch failed");
      const fetched = json.fetched ?? 0;
      const queued = json.queued ?? 0;
      let message = `Fetched ${fetched} email(s), queued ${queued} attachment(s).`;
      if (queued === 0 && fetched > 0) {
        if ((json.skippedNoSuffix ?? 0) > 0) {
          message +=
            " No job address found — emails must be sent to apply.kharta+job{id}@gmail.com (shown on each job’s pipeline tab).";
        } else if ((json.skippedUnknownJob ?? 0) > 0) {
          message +=
            " Job address not recognised — check the job exists and inbound email is active.";
        } else if ((json.skippedUpload ?? 0) > 0) {
          message += " Storage upload failed — check Supabase resumes bucket.";
        }
      }
      setQueueProgress(message);
      window.setTimeout(() => setQueueProgress(""), 5000);
      loadStats();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fetch failed";
      setQueueProgress(message);
      window.setTimeout(() => setQueueProgress(""), 5000);
    } finally {
      setFetching(false);
    }
  };

  const processEmailQueue = async () => {
    setProcessingQueue(true);
    setQueueProgress("");
    let hadError = false;
    try {
      const statsRes = await fetch("/api/admin/email-log");
      const freshStats = await readJsonResponse<{
        queuePending?: number;
        error?: string;
      }>(statsRes, "Failed to load queue stats");
      if (!statsRes.ok) {
        throw new Error(freshStats.error ?? "Failed to load queue stats");
      }
      let remaining = freshStats.queuePending ?? 0;
      setStats((prev) =>
        prev ? { ...prev, queuePending: remaining } : prev,
      );
      if (remaining === 0) {
        setQueueProgress(
          "Queue is empty. Use Fetch from Gmail first, then process.",
        );
        window.setTimeout(() => setQueueProgress(""), 5000);
        return;
      }
      while (true) {
        setQueueProgress(`Processing... (${remaining} remaining)`);
        const res = await fetch("/api/email-process", { method: "POST" });
        const json = await readJsonResponse<{
          processed?: number;
          error?: string;
        }>(res, "Queue processing failed");
        if (!res.ok) {
          throw new Error(json.error ?? "Failed to process queue item");
        }
        if ((json.processed ?? 0) === 0) break;

        const statsRes = await fetch("/api/admin/email-log");
        const statsJson = await readJsonResponse<{
          queuePending?: number;
        }>(statsRes, "Failed to refresh queue stats");
        remaining = statsJson.queuePending ?? 0;
        setStats((prev) =>
          prev ? { ...prev, queuePending: remaining } : prev,
        );
      }
      loadStats();
    } catch (err) {
      hadError = true;
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Queue processing failed";
      setQueueProgress(message);
      window.setTimeout(() => setQueueProgress(""), 5000);
    } finally {
      setProcessingQueue(false);
    }
  };

  return (
    <section className={`${karta.card} p-5`}>
      <h3 className={karta.sectionHeading}>Email Inbound — Last 24 Hours</h3>
      {!stats?.configured ? (
        <p className="mt-2 text-sm text-[#64748B]">
          Email inbound not configured. Add{" "}
          <code className="text-xs">GMAIL_INBOUND_USER</code> and{" "}
          <code className="text-xs">GMAIL_INBOUND_APP_PASSWORD</code> to{" "}
          <code className="text-xs">.env.local</code>, save the file, restart{" "}
          <code className="text-xs">npm run dev</code>, then refresh this page.
          Use a Google App Password (2FA required), not your normal Gmail
          password.
        </p>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-[#64748B]">Emails received</dt>
              <dd className="text-xl font-semibold text-[#1E293B]">
                {stats.received ?? 0}
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Processed OK</dt>
              <dd className="text-xl font-semibold text-[#0D9488]">
                {stats.successful ?? 0}
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Failed</dt>
              <dd
                className={`text-xl font-semibold ${
                  (stats.failed ?? 0) > 0 ? "text-red-600" : "text-[#1E293B]"
                }`}
              >
                {stats.failed ?? 0}
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Last received</dt>
              <dd className="text-sm font-medium text-[#1E293B]">
                {stats.lastReceived
                  ? new Date(stats.lastReceived).toLocaleString()
                  : "—"}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p
              className={`text-sm ${
                (stats.queueFailed ?? 0) > 0
                  ? "text-red-600"
                  : "text-[#64748B]"
              }`}
            >
              Queue: {stats.queuePending ?? 0} pending ·{" "}
              {stats.queueDone ?? 0} processed today ·{" "}
              {stats.queueFailed ?? 0} failed
            </p>
            <button
              type="button"
              onClick={() => void fetchFromGmail()}
              disabled={fetching || processingQueue || retrying}
              className="rounded-lg border border-[#0D9488] bg-white px-3 py-1.5 text-xs font-medium text-[#0D9488] hover:bg-[#F0FDFA] disabled:opacity-60"
            >
              {fetching ? "Fetching…" : "Fetch from Gmail"}
            </button>
            <button
              type="button"
              onClick={() => void processEmailQueue()}
              disabled={processingQueue || retrying || fetching}
              className="rounded-lg bg-[#0D9488] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0f766e] disabled:opacity-60"
            >
              {processingQueue ? queueProgress || "Processing…" : "Process Email Queue"}
            </button>
            {(stats.queueFailed ?? 0) > 0 && (
              <button
                type="button"
                onClick={() => void retryFailed()}
                disabled={retrying || processingQueue || fetching}
                className="rounded border border-red-300 bg-white px-2 py-0.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                {retrying ? "Retrying…" : "Retry failed"}
              </button>
            )}
          </div>
          {queueProgress && !processingQueue && (
            <p
              className={`mt-2 text-sm ${
                queueProgress.startsWith("Processing") ||
                queueProgress.includes("Fetched")
                  ? "text-[#64748B]"
                  : queueProgress.includes("empty")
                    ? "text-amber-700"
                    : "text-red-600"
              }`}
              role="status"
            >
              {queueProgress}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function WorkspaceResetCard({
  onResetComplete,
}: {
  onResetComplete: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const triggerReset = async () => {
    setResetting(true);
    setResetResult(null);
    setResetError(null);
    try {
      const res = await fetch("/api/admin/reset-workspace-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "RESET_ALL_WORKSPACE_DATA" }),
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          "Server returned an unexpected response. Sign in again and retry.",
        );
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Reset failed");
      const deleted = json.deleted as Record<string, number> | undefined;
      const totalRows = deleted
        ? Object.values(deleted).reduce((a, b) => a + b, 0)
        : 0;
      setResetResult(
        `Clean slate — removed ${totalRows} rows across jobs/candidates; ${json.storageFilesRemoved ?? 0} storage files cleared.`,
      );
      setConfirmText("");
      onResetComplete();
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setResetting(false);
    }
  };

  const canReset = confirmText === "RESET" && !resetting;

  return (
    <section className={`${karta.card} border-red-200 p-5`}>
      <h3 className={karta.sectionHeading}>Reset all workspace data</h3>
      <p className="mt-1 text-sm text-[#64748B]">
        Permanently deletes every job, candidate, score, pipeline row, email queue
        item, and resume file. Login accounts and workspace profiles are kept.
      </p>
      <label className="mt-4 block text-sm font-medium text-[#334155]">
        Type <span className="font-mono text-red-700">RESET</span> to enable
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="RESET"
          className={`mt-1 w-full max-w-xs ${karta.input}`}
          autoComplete="off"
        />
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => void triggerReset()}
          disabled={!canReset}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {resetting ? "Resetting…" : "Delete all jobs & candidates"}
        </button>
        {resetResult && (
          <span className="text-sm text-[#64748B]">{resetResult}</span>
        )}
      </div>
      {resetError && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {resetError}
        </p>
      )}
    </section>
  );
}

function DataQualityCard() {
  const [reparsing, setReparsing] = useState(false);
  const [reparseProgress, setReparseProgress] = useState("");
  const [reparseResult, setReparseResult] = useState<string | null>(null);
  const [reparseError, setReparseError] = useState<string | null>(null);

  const triggerReparse = async () => {
    setReparsing(true);
    setReparseResult(null);
    setReparseError(null);
    setReparseProgress("starting...");
    try {
      const res = await fetch("/api/candidates/reparse", { method: "POST" });
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          "Server returned an unexpected response. Sign in again and retry.",
        );
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Reparse failed");
      setReparseResult(`Done — ${json.total} candidates updated.`);
    } catch (err) {
      setReparseError(
        err instanceof Error ? err.message : "Reparse failed",
      );
    } finally {
      setReparsing(false);
      setReparseProgress("");
    }
  };

  return (
    <section className={`${karta.card} p-5`}>
      <h3 className={karta.sectionHeading}>Data Quality</h3>
      <p className="mt-1 text-sm text-[#64748B]">
        Reparse all candidate records using the Kharta resume parser. This
        re-extracts names, skills, experience, and contact details for all
        existing candidates.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => void triggerReparse()}
          disabled={reparsing}
          className="rounded-lg bg-[#0D9488] px-4 py-2 text-sm font-medium text-white hover:bg-[#0f766e] disabled:opacity-60"
        >
          {reparsing
            ? `Reparsing... (${reparseProgress})`
            : "Reparse All Candidates"}
        </button>
        {reparseResult && (
          <span className="text-sm text-[#64748B]">{reparseResult}</span>
        )}
      </div>
      {reparseError && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {reparseError}
        </p>
      )}
    </section>
  );
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
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

  return (
    <div className="space-y-10">
      <nav
        className="flex flex-wrap gap-2 border-b border-slate-200 pb-1"
        aria-label="Admin sections"
      >
        {ADMIN_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-[#4F46E5] bg-[#0B0D14] text-white"
                : "text-[#64748B] hover:text-[#334155]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "costs" ? (
        <AdminCostDashboard />
      ) : (
        <>
      <SystemHealthSection />

      {loading && !overview ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : (
        <>
      {activeTab === "overview" && (
        <>
      <WorkspaceResetCard onResetComplete={() => void load(search)} />
      <DataQualityCard />
      <EmailInboundCard />

      <PlatformAnalyticsSection />

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

      <ResumeParsingWidget />
        </>
      )}

      {activeTab === "workspaces" && (
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
      )}
        </>
      )}
        </>
      )}
    </div>
  );
}
