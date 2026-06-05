"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { HealthLevel, SystemHealthSnapshot } from "@/lib/admin/system-health";
import { karta } from "@/lib/brand/karta";

const REFRESH_MS = 60_000;

function levelBg(level: HealthLevel): string {
  switch (level) {
    case "healthy":
      return "bg-green-50 border-green-100";
    case "warning":
      return "bg-amber-50 border-amber-100";
    case "critical":
      return "bg-red-50 border-red-100";
  }
}

function levelDot(level: HealthLevel): string {
  switch (level) {
    case "healthy":
      return "🟢";
    case "warning":
      return "🟡";
    case "critical":
      return "🔴";
  }
}

function levelText(level: HealthLevel): string {
  switch (level) {
    case "healthy":
      return "text-green-900";
    case "warning":
      return "text-amber-900";
    case "critical":
      return "text-red-900";
  }
}

function HealthCard({
  level,
  title,
  children,
}: {
  level: HealthLevel;
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${levelBg(level)}`}
    >
      <p className={`text-xs font-semibold uppercase tracking-wide ${levelText(level)}`}>
        {levelDot(level)} {title}
      </p>
      <div className={`mt-2 text-sm leading-snug ${levelText(level)}`}>
        {children}
      </div>
    </div>
  );
}

export function SystemHealthSection() {
  const [health, setHealth] = useState<SystemHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/system-health");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to load system health");
      }
      setHealth(json as SystemHealthSnapshot);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load system health");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      void load();
    }, REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [load]);

  if (loading && !health) {
    return (
      <section className={`${karta.card} p-5`}>
        <h2 className={karta.sectionHeading}>System Health</h2>
        <div className="mt-4 flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking platform status…
        </div>
      </section>
    );
  }

  if (error && !health) {
    return (
      <section className={`${karta.card} p-5`}>
        <h2 className={karta.sectionHeading}>System Health</h2>
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      </section>
    );
  }

  if (!health) return null;

  return (
    <section>
      <div className="flex items-center justify-between gap-2">
        <h2 className={karta.sectionHeading}>System Health</h2>
        <span className="text-xs text-[#94A3B8]">Refreshes every 60s</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HealthCard level={health.parsing.level} title="Parsing">
          {health.parsing.message.replace(/^Resume parsing:\s*/i, "")}
        </HealthCard>
        <HealthCard level={health.scoring.level} title="Scoring">
          {health.scoring.message.replace(/^Scoring:\s*/i, "")}
        </HealthCard>
        <HealthCard level={health.dataIsolation.level} title="Data isolation">
          {health.dataIsolation.orphanCount === 0
            ? "All candidates have owner assigned"
            : health.dataIsolation.message.replace(/^Data isolation:\s*/i, "")}
        </HealthCard>
        <HealthCard level={health.lastActivity.level} title="Last activity">
          <p>
            Last upload: {health.lastActivity.lastUpload.name} —{" "}
            {health.lastActivity.lastUpload.timeAgo}
          </p>
          <p className="mt-1">
            Last score: {health.lastActivity.lastScore.roleTitle} —{" "}
            {health.lastActivity.lastScore.timeAgo}
          </p>
        </HealthCard>
      </div>
      {error && (
        <p className="mt-2 text-xs text-amber-700" role="status">
          Last refresh failed: {error}
        </p>
      )}
    </section>
  );
}
