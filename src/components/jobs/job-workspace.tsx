"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { JobApplicantsTab } from "@/components/jobs/tabs/job-applicants-tab";
import { JobAssessedTab } from "@/components/jobs/tabs/job-assessed-tab";
import { JobOverviewTab } from "@/components/jobs/tabs/job-overview-tab";
import { JobShortlistTab } from "@/components/jobs/tabs/job-shortlist-tab";
import { formatKartaDate } from "@/lib/dates/format-karta-date";
import { getErrorMessage } from "@/lib/errors";
import type { Job } from "@/types/job";
import { JOB_STATUS_LABELS } from "@/types/job";

const TABS = [
  ["overview", "Overview"],
  ["applicants", "Applicants"],
  ["assessed", "Assessed"],
  ["shortlist", "Shortlist"],
] as const;

type JobTab = (typeof TABS)[number][0];

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

export function JobWorkspace({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [tab, setTab] = useState<JobTab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadJob = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      const text = await res.text();
      let json: { job?: Job; error?: string } = {};
      if (text) {
        try {
          json = JSON.parse(text) as { job?: Job; error?: string };
        } catch {
          throw new Error("Invalid response from server.");
        }
      }
      if (!res.ok) throw new Error(json.error ?? "Failed to load job");
      setJob(json.job as Job);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load job"));
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void loadJob();
  }, [loadJob]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-4">
        <Link href="/jobs" className="inline-flex items-center gap-2 text-sm text-[#64748B] hover:text-[#1E293B]">
          <ArrowLeft className="h-4 w-4" />
          Back to Jobs
        </Link>
        <p className="text-red-600">{error ?? "Job not found."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/jobs"
          className="inline-flex items-center gap-2 text-sm text-[#64748B] hover:text-[#1E293B]"
        >
          <ArrowLeft className="h-4 w-4" />
          Jobs
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-[#1E293B]">{job.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {job.title_band && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-[#64748B]">
              {job.title_band}
            </span>
          )}
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(job.status)}`}
          >
            {JOB_STATUS_LABELS[job.status]}
          </span>
          <span className="text-sm text-[#64748B]">
            Posted {formatKartaDate(job.created_at)}
          </span>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-1">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium transition ${
              tab === id
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <JobOverviewTab job={job} onJobUpdated={setJob} />
      )}
      {tab === "applicants" && (
        <JobApplicantsTab
          jobId={job.id}
          jobTitle={job.title}
          roleBrief={job}
          onGoToAssessed={() => setTab("assessed")}
        />
      )}
      {tab === "assessed" && (
        <JobAssessedTab jobId={job.id} roleBrief={job} />
      )}
      {tab === "shortlist" && (
        <JobShortlistTab
          jobId={job.id}
          jobTitle={job.title}
          titleBand={job.title_band}
          roleBrief={job}
        />
      )}
    </div>
  );
}
