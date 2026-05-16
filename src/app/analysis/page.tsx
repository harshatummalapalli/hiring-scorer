"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { AnalysisDashboard } from "@/components/analysis/analysis-dashboard";
import { computeAnalysisFindings } from "@/lib/analysis/compute-findings";
import type { AnalysisFindings } from "@/lib/analysis/compute-findings";
import {
  buildAnalysisEntriesWithHistoricalSeeds,
  parseScoringRunRow,
} from "@/lib/analysis/load-analysis-data";
import { HISTORICAL_RUN_COUNT } from "@/lib/analysis/seed-historical";
import type { ScoringRun } from "@/types/scoring-run";

export default function AnalysisPage() {
  const [findings, setFindings] = useState<AnalysisFindings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    let dbRuns: ScoringRun[] = [];

    try {
      const res = await fetch("/api/scoring-runs");
      if (res.ok) {
        const data = (await res.json()) as { runs?: Record<string, unknown>[] };
        dbRuns = (data.runs ?? []).map(parseScoringRunRow);
      }
    } catch {
      /* use in-memory seeds only */
    }

    try {
      const seedRes = await fetch("/api/scoring-runs/seed", { method: "POST" });
      if (seedRes.ok) {
        const seedData = (await seedRes.json()) as {
          inserted?: number;
          updated?: number;
        };
        setSeedStatus(
          `Historical seed: ${HISTORICAL_RUN_COUNT} runs (${seedData.inserted ?? 0} inserted, ${seedData.updated ?? 0} updated in Supabase).`,
        );
        const refresh = await fetch("/api/scoring-runs");
        if (refresh.ok) {
          const refreshed = (await refresh.json()) as {
            runs?: Record<string, unknown>[];
          };
          dbRuns = (refreshed.runs ?? []).map(parseScoringRunRow);
        }
      } else {
        setSeedStatus(
          `Showing ${HISTORICAL_RUN_COUNT} built-in historical runs (Supabase seed skipped — run supabase/scoring_runs.sql if the table is missing).`,
        );
      }
    } catch {
      setSeedStatus(
        `Showing ${HISTORICAL_RUN_COUNT} built-in historical runs in analysis.`,
      );
    }

    const entries = buildAnalysisEntriesWithHistoricalSeeds(dbRuns);
    setFindings(computeAnalysisFindings(entries));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const preloadedCount = useMemo(
    () => findings?.entries.length ?? HISTORICAL_RUN_COUNT,
    [findings],
  );

  if (loading && !findings) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        <span className="text-sm">Loading analysis ({HISTORICAL_RUN_COUNT} historical runs)…</span>
      </div>
    );
  }

  if (!findings) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-red-600">
        {error ?? "Unable to load analysis."}
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <AnalysisDashboard
        findings={findings}
        loading={loading}
        onRefresh={() => void load()}
        seedStatus={seedStatus}
      />
      <p className="mx-auto max-w-6xl px-4 text-center text-xs text-slate-400 sm:px-6">
        Analysis includes {preloadedCount} run(s) · generated{" "}
        {new Date(findings.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}
