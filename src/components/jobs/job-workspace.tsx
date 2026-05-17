"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { JobApplicantsTab } from "@/components/jobs/tabs/job-applicants-tab";
import { JobOverviewTab } from "@/components/jobs/tabs/job-overview-tab";
import { JobReachOutTab } from "@/components/jobs/tabs/job-reach-out-tab";
import { JobShortlistTab } from "@/components/jobs/tabs/job-shortlist-tab";
import { JobTalentPoolTab } from "@/components/jobs/tabs/job-talent-pool-tab";
import { karta } from "@/lib/brand/karta";
import { getErrorMessage } from "@/lib/errors";
import type { Job } from "@/types/job";

const TABS = [
  ["overview", "Overview"],
  ["applicants", "Applicants"],
  ["talent", "From Your Talent Pool"],
  ["shortlist", "Shortlist"],
  ["reach", "Reach Out"],
] as const;

type JobTab = (typeof TABS)[number][0];

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
        {job.title_band && (
          <span className="mt-2 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-[#64748B]">
            {job.title_band}
          </span>
        )}
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
        <JobOverviewTab job={job} onJobUpdated={setJob} onRegenerateComplete={loadJob} />
      )}
      {tab === "applicants" && <JobApplicantsTab jobId={job.id} jobTitle={job.title} />}
      {tab === "talent" && <JobTalentPoolTab jobId={job.id} jobTitle={job.title} />}
      {tab === "shortlist" && (
        <JobShortlistTab jobId={job.id} jobTitle={job.title} titleBand={job.title_band} />
      )}
      {tab === "reach" && <JobReachOutTab jobId={job.id} />}
    </div>
  );
}
