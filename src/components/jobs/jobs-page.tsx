"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import { RoleBriefCreator } from "@/components/role-briefs/role-brief-creator";
import { JobLimitModal } from "@/components/workspace/job-limit-modal";
import { karta } from "@/lib/brand/karta";
import { getErrorMessage } from "@/lib/errors";
import type { JobListItem } from "@/types/job";
import { JOB_STATUS_LABELS } from "@/types/job";
import type { RoleBriefAnalysis, RoleBriefAnalysisMeta } from "@/types/role-brief";
import { useRouter } from "next/navigation";

function statusBadgeClass(status: string): string {
  switch (status) {
    case "paused":
      return "bg-amber-100 text-amber-800";
    case "filled":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-[#0D9488]/15 text-[#0D9488]";
  }
}

type WorkspaceUsage = {
  jobs: { current: number; max: number };
  candidates: { current: number; max: number };
};

export function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [usage, setUsage] = useState<WorkspaceUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPost, setShowPost] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showJobLimitModal, setShowJobLimitModal] = useState(false);

  const loadUsage = useCallback(async () => {
    try {
      const res = await fetch("/api/workspace/usage");
      const json = await res.json();
      if (res.ok) setUsage(json as WorkspaceUsage);
    } catch {
      /* usage indicator is optional */
    }
  }, []);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load jobs");
      setJobs(json.jobs as JobListItem[]);
      void loadUsage();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load jobs"));
    } finally {
      setLoading(false);
    }
  }, [loadUsage]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const handleSaveNewJob = async (data: {
    title: string;
    jobDescription: string;
    analysis: RoleBriefAnalysis;
    analysisMeta: RoleBriefAnalysisMeta;
  }) => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "JOB_LIMIT_REACHED") {
          setShowPost(false);
          setShowJobLimitModal(true);
          return;
        }
        throw new Error(json.error ?? "Failed to save job");
      }
      setShowPost(false);
      void loadUsage();
      router.push(`/jobs/${json.job.id}`);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save job"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E293B]">Jobs</h1>
          {usage && (
            <p className="mt-1 text-xs text-[#94A3B8]">
              {usage.jobs.current} of {usage.jobs.max} jobs ·{" "}
              {usage.candidates.current} of {usage.candidates.max} candidates
            </p>
          )}
          <p className="mt-1 text-sm text-[#64748B]">
            Manage open roles, applicants, and shortlists in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowPost(true)}
          className={`inline-flex items-center gap-2 ${karta.btnPrimary}`}
        >
          <Plus className="h-4 w-4" />
          Post a Job
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : jobs.length === 0 ? (
        <div className={`${karta.card} border-dashed px-6 py-16 text-center`}>
          <p className="font-medium text-[#334155]">No jobs yet</p>
          <p className="mt-1 text-sm text-[#64748B]">
            Post your first job to start receiving and scoring applicants.
          </p>
          <button
            type="button"
            onClick={() => setShowPost(true)}
            className={`mt-6 inline-flex items-center gap-2 ${karta.btnPrimary}`}
          >
            <Plus className="h-4 w-4" />
            Post a Job
          </button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <li key={job.id} className={`flex flex-col ${karta.card} p-5`}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-[#1E293B]">{job.title}</h2>
                {job.title_band && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-[#64748B]">
                    {job.title_band}
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadgeClass(job.status)}`}
                >
                  {JOB_STATUS_LABELS[job.status]}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-[#64748B]">Applicants</dt>
                  <dd className="font-semibold text-[#1E293B]">{job.applicantCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#64748B]">Strong matches</dt>
                  <dd className="font-semibold text-[#0D9488]">{job.strongMatches}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#64748B]">Potential matches</dt>
                  <dd className="font-semibold text-amber-700">{job.potentialMatches}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[#64748B]">Posted</dt>
                  <dd className="font-semibold text-[#1E293B]">
                    {job.daysSinceCreated === 0
                      ? "Today"
                      : `${job.daysSinceCreated}d ago`}
                  </dd>
                </div>
              </dl>
              <Link
                href={`/jobs/${job.id}`}
                className={`mt-6 inline-flex w-full justify-center ${karta.btnPrimary}`}
              >
                Open Job
              </Link>
            </li>
          ))}
        </ul>
      )}

      {showPost && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl sm:p-10">
            <button
              type="button"
              onClick={() => setShowPost(false)}
              className="absolute right-4 top-4 text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              Close
            </button>
            <h2 className="text-xl font-semibold text-[#1E293B] pr-16">Post a job</h2>
            <p className="mt-1 text-sm text-[#64748B]">
              Paste the JD — Karta will extract requirements and generate a scoring prompt.
            </p>
            <div className="mt-8">
              <RoleBriefCreator onSave={handleSaveNewJob} isSaving={isSaving} />
            </div>
          </div>
        </div>
      )}

      <JobLimitModal
        open={showJobLimitModal}
        onClose={() => setShowJobLimitModal(false)}
      />
    </div>
  );
}
