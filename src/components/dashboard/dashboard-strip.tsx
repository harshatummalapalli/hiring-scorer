"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type DashboardStats = {
  activeJobs: number;
  inPipeline: number;
  exceptionalMatches: number;
  strongMatches: number;
  shortlistedThisWeek: number;
  evaluatedToday: number;
  totalCandidates: number;
};

const METRICS: {
  key: keyof DashboardStats;
  label: string;
  color: string;
}[] = [
  { key: "activeJobs", label: "Active Jobs", color: "#0D9488" },
  { key: "inPipeline", label: "In Pipeline", color: "#378ADD" },
  { key: "exceptionalMatches", label: "Exceptional Matches", color: "#7F77DD" },
  { key: "strongMatches", label: "Strong Matches", color: "#1D9E75" },
  { key: "shortlistedThisWeek", label: "Shortlisted This Week", color: "#BA7517" },
  { key: "evaluatedToday", label: "Evaluated Today", color: "#5DCAA5" },
  { key: "totalCandidates", label: "Total Candidates", color: "#888780" },
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

  function handleStatClick(key: keyof DashboardStats) {
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {loading
        ? METRICS.map((m) => <SkeletonTile key={m.key} />)
        : stats &&
          METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => handleStatClick(m.key)}
              className="stat-card w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50/80"
              style={{ borderTopColor: m.color }}
            >
              <p
                className="stat-number"
                style={{ color: m.color }}
              >
                {stats[m.key]}
              </p>
              <p className="mt-1 text-xs text-[#64748B]">{m.label}</p>
            </button>
          ))}
    </div>
  );
}
