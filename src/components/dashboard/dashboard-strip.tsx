"use client";

import { useEffect, useState } from "react";

type DashboardStats = {
  activeJobs: number;
  totalCandidates: number;
  inPipeline: number;
  shortlistedThisWeek: number;
  strongMatches: number;
  evaluatedToday: number;
};

const METRICS: {
  key: keyof DashboardStats;
  label: string;
}[] = [
  { key: "activeJobs", label: "Active Jobs" },
  { key: "inPipeline", label: "In Pipeline" },
  { key: "strongMatches", label: "Strong Matches" },
  { key: "shortlistedThisWeek", label: "Shortlisted This Week" },
  { key: "evaluatedToday", label: "Evaluated Today" },
  { key: "totalCandidates", label: "Total Candidates" },
];

function SkeletonTile() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="h-8 w-12 animate-pulse rounded bg-slate-100" />
      <div className="mt-2 h-3 w-20 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

export function DashboardStrip() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/dashboard");
        const json = await res.json();
        if (!res.ok || cancelled) return;
        setStats(json as DashboardStats);
      } catch {
        /* fail silently */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && !stats) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {loading
        ? METRICS.map((m) => <SkeletonTile key={m.key} />)
        : stats &&
          METRICS.map((m) => (
            <div
              key={m.key}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <p className="text-2xl font-semibold text-[#0D9488]">
                {stats[m.key]}
              </p>
              <p className="mt-1 text-xs text-[#64748B]">{m.label}</p>
            </div>
          ))}
    </div>
  );
}
