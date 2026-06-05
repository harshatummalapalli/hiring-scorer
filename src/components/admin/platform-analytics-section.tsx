"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { karta } from "@/lib/brand/karta";
import type { PlatformAnalyticsPayload } from "@/lib/admin/analytics-queries";

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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PlatformAnalyticsSection() {
  const [data, setData] = useState<PlatformAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/analytics", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof json.error === "string"
            ? json.hint
              ? `${json.error} ${json.hint}`
              : json.error
            : "Failed to load analytics",
        );
      }
      setData(json as PlatformAnalyticsPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-4">
      <h2 className={karta.sectionHeading}>Platform analytics</h2>

      {loading && !data ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Active recruiters (7 days)"
              value={data.activeRecruiters7d}
            />
            <MetricCard
              label="Candidates scored this week"
              value={data.candidatesScoredThisWeek}
            />
            <MetricCard
              label="Jobs created this month"
              value={data.jobsCreatedThisMonth}
            />
            <MetricCard
              label="Interview briefs this week"
              value={data.interviewBriefsThisWeek}
            />
          </div>

          <div className={`overflow-x-auto ${karta.card}`}>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                <tr>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.events.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-[#64748B]"
                    >
                      No events recorded yet.
                    </td>
                  </tr>
                ) : (
                  data.events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-50/50">
                      <td className="whitespace-nowrap px-4 py-3 text-[#64748B]">
                        {formatTime(ev.createdAt)}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 font-medium text-[#1E293B]">
                        {ev.userEmail}
                      </td>
                      <td className="px-4 py-3 text-[#334155]">
                        {ev.eventType}
                      </td>
                      <td className="max-w-md truncate px-4 py-3 text-[#64748B]">
                        {ev.details}
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
