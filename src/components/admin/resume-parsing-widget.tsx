"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { karta } from "@/lib/brand/karta";

type ResumeParsingPayload = {
  parserLabel: string;
  candidatesParsedThisMonth: number;
  parseFailuresThisMonth: number;
  monthUtc: string;
};

export function ResumeParsingWidget() {
  const [data, setData] = useState<ResumeParsingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/resume-parsing", {
        cache: "no-store",
      });
      if (res.status === 404) {
        setError("Not found");
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load stats");
      setData(json as ResumeParsingPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const monthLabel = data?.monthUtc
    ? new Date(`${data.monthUtc}-01T00:00:00Z`).toLocaleString(undefined, {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : "this month";

  return (
    <section className={`${karta.card} p-5`}>
      <h3 className={karta.sectionHeading}>
        Resume parsing — {monthLabel}
      </h3>
      {loading && !data ? (
        <div className="mt-4 flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : error ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : data ? (
        <>
          <p className="mt-2 text-sm text-[#64748B]">
            Parser:{" "}
            <span className="font-medium text-[#334155]">{data.parserLabel}</span>
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:max-w-md">
            <div>
              <dt className="text-[#64748B]">Candidates parsed</dt>
              <dd className="text-xl font-semibold text-[#1E293B]">
                {data.candidatesParsedThisMonth.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Parse failures</dt>
              <dd
                className={`text-xl font-semibold ${
                  data.parseFailuresThisMonth > 0
                    ? "text-red-600"
                    : "text-[#1E293B]"
                }`}
              >
                {data.parseFailuresThisMonth.toLocaleString()}
              </dd>
            </div>
          </dl>
        </>
      ) : null}
    </section>
  );
}
