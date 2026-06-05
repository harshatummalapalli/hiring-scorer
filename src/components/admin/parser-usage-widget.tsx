"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { karta } from "@/lib/brand/karta";

type ParserUsagePayload = {
  totalVcpu: number;
  totalGib: number;
  vcpuPct: number;
  gibPct: number;
  bindingPct: number;
  totalParses: number;
  successParses: number;
  resumesRemaining: number;
  monthStart: string;
  freeTier: { vcpu: number; gib: number };
  alert: "ok" | "warning" | "critical";
};

function ProgressBar({
  label,
  pct,
  used,
  limit,
  unit,
}: {
  label: string;
  pct: number;
  used: number;
  limit: number;
  unit: string;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  const barColor =
    pct >= 95 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-[#0D9488]";

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-[#334155]">{label}</span>
        <span className="text-[#64748B]">{pct.toFixed(1)}%</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-[#64748B]">
        {used.toLocaleString()} / {limit.toLocaleString()} {unit}
      </p>
    </div>
  );
}

export function ParserUsageWidget() {
  const [data, setData] = useState<ParserUsagePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/parser-usage", {
        cache: "no-store",
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          "Server returned HTML instead of JSON. Sign in again at /auth/signin, or confirm you are a super admin.",
        );
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load usage");
      setData(json as ParserUsagePayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className={`${karta.card} flex justify-center p-8`}>
        <Loader2 className="h-6 w-6 animate-spin text-[#0D9488]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${karta.card} p-5`}>
        <p className="text-sm text-red-600">{error}</p>
        <p className="mt-1 text-xs text-[#64748B]">
          Run supabase/parser-usage-log.sql if the table is missing.
        </p>
      </div>
    );
  }

  if (!data) return null;

  const successRate =
    data.totalParses > 0
      ? ((data.successParses / data.totalParses) * 100).toFixed(1)
      : "—";

  return (
    <section className={`${karta.card} p-5`}>
      <h2 className={karta.sectionHeading}>
        Resume parsing capacity — this month
      </h2>
      <p className="mt-1 text-xs text-[#64748B]">
        Monthly parsing allowance (resets on the 1st)
      </p>

      <div className="mt-5 space-y-4">
        <ProgressBar
          label="vCPU Usage"
          pct={data.vcpuPct}
          used={data.totalVcpu}
          limit={data.freeTier.vcpu}
          unit="vCPU-seconds"
        />
        <ProgressBar
          label="Memory Usage"
          pct={data.gibPct}
          used={data.totalGib}
          limit={data.freeTier.gib}
          unit="GiB-seconds"
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            Parses this month
          </p>
          <p className="mt-1 text-lg font-semibold text-[#1E293B]">
            {data.totalParses.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            Success rate
          </p>
          <p className="mt-1 text-lg font-semibold text-[#1E293B]">
            {successRate}%
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            Est. resumes remaining
          </p>
          <p className="mt-1 text-lg font-semibold text-[#1E293B]">
            {data.resumesRemaining.toLocaleString()}
          </p>
        </div>
      </div>

      {data.alert === "warning" && (
        <div className="mt-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <p>
            Approaching free tier limit —{" "}
            {data.resumesRemaining.toLocaleString()} resumes remaining this
            month. Usage resets on the 1st.
          </p>
        </div>
      )}

      {data.alert === "critical" && (
        <div className="mt-4 flex gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <p>
            Critical: Parsing capacity is nearly exhausted. Throttle uploads
            until the monthly reset or contact support.
          </p>
        </div>
      )}
    </section>
  );
}
