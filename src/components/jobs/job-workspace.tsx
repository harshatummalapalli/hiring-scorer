"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail, Settings } from "lucide-react";
import { JobPipelineTab } from "@/components/jobs/tabs/job-pipeline-tab";
import { JobShortlistTab } from "@/components/jobs/tabs/job-shortlist-tab";
import { JobSettingsPanel } from "@/components/jobs/job-settings-panel";
import { formatKartaDate } from "@/lib/dates/format-karta-date";
import { getErrorMessage } from "@/lib/errors";
import type { Job } from "@/types/job";
import { SlidingTabs } from "@/components/ui/sliding-tabs";
import { karta } from "@/lib/brand/karta";
import { JOB_STATUS_LABELS } from "@/types/job";

const TABS = [
  ["pipeline", "Pipeline"],
  ["shortlist", "Shortlist"],
] as const;

type JobTab = "pipeline" | "shortlist";

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

function fallbackCopy(text: string) {
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.focus();
  el.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(el);
  }
}

export function JobWorkspace({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<Job | null>(null);
  const [tab, setTab] = useState<JobTab>("pipeline");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailCopied, setEmailCopied] = useState(false);

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
        <Link
          href="/jobs"
          className="inline-flex items-center gap-2 text-sm text-[#64748B] hover:text-[#1E293B]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Jobs
        </Link>
        <p className="text-red-600">{error ?? "Job not found."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <Link
            href="/jobs"
            className="inline-flex items-center gap-2 text-sm text-[#64748B] hover:text-[#1E293B]"
          >
            <ArrowLeft className="h-4 w-4" />
            Jobs
          </Link>
          <h1 className={`mt-4 ${karta.pageTitle}`}>{job.title}</h1>
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
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const email = job.inbound_email;
              if (!email) return;
              const onCopied = () => {
                setEmailCopied(true);
                setTimeout(() => setEmailCopied(false), 2000);
              };
              if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(email).then(onCopied).catch(() => {
                  fallbackCopy(email);
                  onCopied();
                });
              } else {
                fallbackCopy(email);
                onCopied();
              }
            }}
            title="Copy apply email for Naukri/LinkedIn"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-[#64748B] hover:bg-slate-50"
          >
            <Mail className="h-4 w-4" />
            {emailCopied ? "Copied!" : "Copy Apply Email"}
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            aria-label="Job settings"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>

      <SlidingTabs
        tabs={TABS.map(([id, label]) => ({ id, label }))}
        value={tab}
        onChange={setTab}
      />

      {tab === "pipeline" && (
        <JobPipelineTab
          jobId={job.id}
          jobTitle={job.title}
          roleBrief={job}
        />
      )}
      {tab === "shortlist" && (
        <JobShortlistTab
          jobId={job.id}
          jobTitle={job.title}
          titleBand={job.title_band}
          roleBrief={job}
        />
      )}

      <JobSettingsPanel
        job={job}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onJobUpdated={setJob}
      />
    </div>
  );
}
