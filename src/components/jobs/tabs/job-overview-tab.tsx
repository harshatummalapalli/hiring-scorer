"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { karta } from "@/lib/brand/karta";
import { formatKartaDate } from "@/lib/dates/format-karta-date";
import { getErrorMessage } from "@/lib/errors";
import type { Job } from "@/types/job";
import { JOB_STATUS_LABELS } from "@/types/job";

function statusBadgeClass(status: string): string {
  switch (status) {
    case "paused":
      return "bg-amber-100 text-amber-800";
    case "filled":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-emerald-100 text-emerald-800";
  }
}
import { analysisFromRoleBrief } from "@/types/role-brief";

type JobOverviewTabProps = {
  job: Job;
  onJobUpdated: (job: Job) => void;
};

export function JobOverviewTab({ job, onJobUpdated }: JobOverviewTabProps) {
  const analysis = analysisFromRoleBrief(job);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/analyse-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleBriefId: job.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Regeneration failed");
      const jobRes = await fetch(`/api/jobs/${job.id}`);
      const jobJson = await jobRes.json();
      if (!jobRes.ok) throw new Error(jobJson.error ?? "Failed to refresh job");
      onJobUpdated(jobJson.job as Job);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to regenerate"));
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <section className={`${karta.card} p-6`}>
        <h3 className={karta.sectionHeading}>Job Details</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-[#64748B]">Title</dt>
            <dd className="mt-1 text-sm font-semibold text-[#1E293B]">{job.title}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-[#64748B]">Band</dt>
            <dd className="mt-1">
              {job.title_band ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-[#64748B]">
                  {job.title_band}
                </span>
              ) : (
                <span className="text-sm text-[#64748B]">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-[#64748B]">Status</dt>
            <dd className="mt-1">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(job.status)}`}
              >
                {JOB_STATUS_LABELS[job.status]}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-[#64748B]">Posted</dt>
            <dd className="mt-1 text-sm font-semibold text-[#1E293B]">
              {formatKartaDate(job.created_at)}
            </dd>
          </div>
        </dl>
      </section>

      <section className={`${karta.card} p-6`}>
        <h3 className={karta.sectionHeading}>Must Haves</h3>
        <ul className="mt-3 space-y-2">
          {analysis.deal_breakers.length === 0 ? (
            <li className="text-sm text-[#64748B]">None extracted</li>
          ) : (
            analysis.deal_breakers.map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 text-sm text-[#334155]"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0D9488]" />
                {item}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className={`${karta.card} p-6`}>
        <h3 className={karta.sectionHeading}>Key Requirements</h3>
        <ul className="mt-3 space-y-4">
          {analysis.core_signals.length === 0 ? (
            <li className="text-sm text-[#64748B]">None extracted</li>
          ) : (
            analysis.core_signals.map((signal) => (
              <li key={signal.skill}>
                <p className="font-semibold text-[#1E293B]">{signal.skill}</p>
                {signal.equivalents.length > 0 && (
                  <p className="mt-0.5 text-xs text-[#94A3B8]">
                    {signal.equivalents.join(", ")}
                  </p>
                )}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className={`${karta.card} p-6`}>
        <h3 className={karta.sectionHeading}>Nice to Haves</h3>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#334155]">
          {analysis.preferred_signals.length === 0 ? (
            <li className="list-none pl-0 text-[#64748B]">None listed</li>
          ) : (
            analysis.preferred_signals.map((s) => <li key={s}>{s}</li>)
          )}
        </ul>
      </section>

      <section className={`${karta.card} p-6`}>
        <h3 className={karta.sectionHeading}>Assess in Interview</h3>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#334155]">
          {analysis.cannot_assess.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[#64748B]">
          These cannot be evaluated from a resume alone.
        </p>
      </section>

      <section className={`${karta.card} p-6`}>
        <h3 className={karta.sectionHeading}>Scoring Intelligence</h3>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-[#0D9488]">
            Prompt ready
          </span>
          {job.last_analysed_at && (
            <span className="text-sm text-[#64748B]">
              Generated {formatKartaDate(job.last_analysed_at)}
            </span>
          )}
          <button
            type="button"
            disabled={regenerating}
            onClick={() => void handleRegenerate()}
            className={karta.btnSecondary}
          >
            {regenerating ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Regenerating…
              </span>
            ) : (
              "Regenerate"
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
