"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type DashboardStats = {
  activeJobs: number;
  totalCandidates: number;
  inPipeline: number;
  shortlistedThisWeek: number;
  exceptionalMatches: number;
  strongMatches: number;
  evaluatedToday: number;
};

const METRICS: {
  key: keyof DashboardStats;
  label: string;
}[] = [
  { key: "activeJobs", label: "Active Jobs" },
  { key: "inPipeline", label: "In Pipeline" },
  { key: "exceptionalMatches", label: "Exceptional Matches" },
  { key: "strongMatches", label: "Strong Matches" },
  { key: "shortlistedThisWeek", label: "Shortlisted This Week" },
  { key: "evaluatedToday", label: "Evaluated Today" },
  { key: "totalCandidates", label: "Total Candidates" },
];

function statValueClass(key: keyof DashboardStats): string {
  if (key === "exceptionalMatches") return "text-violet-600";
  if (key === "strongMatches") return "text-[#0D9488]";
  return "text-[#1E293B]";
}

function SkeletonTile() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
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
              className="w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:bg-slate-50"
            >
              <p className={`text-2xl font-semibold ${statValueClass(m.key)}`}>
                {stats[m.key]}
              </p>
              <p className="mt-1 text-xs text-[#64748B]">{m.label}</p>
            </button>
          ))}
    </div>
  );
}
