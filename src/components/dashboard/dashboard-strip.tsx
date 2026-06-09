"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { OutcomeFunnel, type OutcomeFunnelStats } from "./outcome-funnel";

type DashboardStats = {
  activeJobs: number;
  inPipeline: number;
  exceptionalMatches: number;
  strongMatches: number;
  shortlistedThisWeek: number;
  evaluatedToday: number;
  totalCandidates: number;
  funnel?: OutcomeFunnelStats;
};

type DashboardMetricKey = Exclude<keyof DashboardStats, "funnel">;

const METRICS: {
  key: DashboardMetricKey;
  label: string;
  borderClass: string;
  valueClass: string;
}[] = [
  { key: "activeJobs", label: "Active Jobs", borderClass: "border-t-slate-600", valueClass: "text-slate-600" },
  { key: "inPipeline", label: "In Pipeline", borderClass: "border-t-blue-500", valueClass: "text-blue-600" },
  { key: "exceptionalMatches", label: "Exceptional Matches", borderClass: "border-t-violet-500", valueClass: "text-violet-600" },
  { key: "strongMatches", label: "Strong Matches", borderClass: "border-t-emerald-500", valueClass: "text-emerald-600" },
  { key: "shortlistedThisWeek", label: "Shortlisted This Week", borderClass: "border-t-amber-500", valueClass: "text-amber-600" },
  { key: "evaluatedToday", label: "Evaluated Today", borderClass: "border-t-teal-500", valueClass: "text-teal-600" },
  { key: "totalCandidates", label: "Total Candidates", borderClass: "border-t-slate-400", valueClass: "text-slate-500" },
];

function SkeletonTile() {
  return (
    <div className="stat-card rounded-lg border border-slate-200 border-t-slate-200 bg-white p-4">
      <div className="h-8 w-12 animate-pulse rounded bg-slate-100" />
      <div className="mt-2 h-3 w-20 animate-pulse rounded bg-slate-100" />
    </div>
  );
}

export function DashboardStrip() {
  const router = useRouter();
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

  function handleStatClick(key: DashboardMetricKey) {
    switch (key) {
      case "activeJobs":
        document
          .getElementById("job-cards")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      case "inPipeline":
        router.push("/talent-pool");
        break;
      case "exceptionalMatches":
        router.push("/talent-pool?verdict=exceptional_match");
        break;
      case "strongMatches":
        router.push("/talent-pool?verdict=strong_match");
        break;
      case "shortlistedThisWeek":
        router.push("/pipeline");
        break;
      case "evaluatedToday":
        router.push("/talent-pool");
        break;
      case "totalCandidates":
        router.push("/talent-pool");
        break;
      default:
        break;
    }
  }

  if (!loading && !stats) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {loading
          ? METRICS.map((m) => <SkeletonTile key={m.key} />)
          : stats &&
            METRICS.map((m, index) => (
              <button
                key={m.key}
                type="button"
                onClick={() => handleStatClick(m.key)}
                className={`stat-card w-full cursor-pointer rounded-xl border border-slate-200/60 bg-white p-4 text-left shadow-sm transition-colors hover:bg-slate-50/80 border-t-2 ${m.borderClass}`}
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <p
                  className={`text-2xl font-semibold ${m.valueClass}`}
                  style={{
                    animation: "count-fade 0.4s ease-out backwards",
                    animationDelay: `${index * 80}ms`,
                  }}
                >
                  {stats[m.key]}
                </p>
                <p className="mt-1 text-xs text-slate-500">{m.label}</p>
              </button>
            ))}
      </div>
      {!loading && stats?.funnel && (
        <OutcomeFunnel funnel={stats.funnel} />
      )}
    </div>
  );
}
