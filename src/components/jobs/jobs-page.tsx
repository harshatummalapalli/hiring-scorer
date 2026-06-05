"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Loader2,
  Mail,
  MoreVertical,
  Pause,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { DashboardStrip } from "@/components/dashboard/dashboard-strip";
import { CopyButton } from "@/components/ui/copy-button";
import { EmptyState } from "@/components/ui/empty-state";
import { karta } from "@/lib/brand/karta";
import { formatKartaDate } from "@/lib/dates/format-karta-date";
import { getErrorMessage } from "@/lib/errors";
import { isUnlimitedWorkspaceCap } from "@/lib/workspace/limits";
import type { JobListItem } from "@/types/job";
import { JOB_STATUS_COLORS, JOB_STATUS_LABELS, type JobStatus } from "@/types/job";
import { useRouter, useSearchParams } from "next/navigation";
import { existingCompanySignupMessage } from "@/lib/workspace/existing-company-workspace";

function statusBadgeClass(status: string): string {
  return JOB_STATUS_COLORS[status as JobStatus] ?? JOB_STATUS_COLORS.active;
}

type WorkspaceUsage = {
  jobs: { current: number; max: number };
  candidates: { current: number; max: number };
};

function JobCard({
  job,
  onReload,
  onError,
}: {
  job: JobListItem;
  onReload: () => void;
  onError: (message: string) => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [menuOpen]);

  const isArchived =
    job.status === "archived" ||
    job.status === "filled" ||
    job.status === "cancelled";

  const patchStatus = async (newStatus: JobStatus) => {
    setMenuOpen(false);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to update job");
      onReload();
    } catch (err) {
      onError(getErrorMessage(err, "Failed to update job"));
    }
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    const confirmed = window.confirm(
      "Delete this job? This cannot be undone. Candidates already evaluated will remain in your Talent Pool.",
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to delete job");
      onReload();
    } catch (err) {
      onError(getErrorMessage(err, "Failed to delete job"));
    }
  };

  const goToJob = () => router.push(`/jobs/${job.id}`);

  return (
    <li
      role="button"
      tabIndex={0}
      onClick={goToJob}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToJob();
        }
      }}
      className={`job-card relative flex h-full min-h-[240px] cursor-pointer flex-col ${karta.card} p-5 ${
        job.status === "paused" ? "opacity-70" : ""
      } ${isArchived ? "opacity-60" : ""} ${
        job.status === "active" && !isArchived ? karta.jobCardActive : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-h-[3rem] min-w-0 flex-1 flex-wrap items-start gap-2">
          <h2 className={`${karta.cardTitle} leading-snug`}>{job.title}</h2>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
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
        </div>
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((open) => !open);
            }}
            className="rounded-md p-1 text-[#64748B] hover:bg-slate-100 hover:text-[#1E293B]"
            aria-label="Job actions"
            aria-expanded={menuOpen}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute top-8 right-0 z-20 min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {job.status === "active" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void patchStatus("paused");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <Pause className="h-4 w-4 shrink-0" />
                  Pause Job
                </button>
              )}
              {job.status === "paused" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void patchStatus("active");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <Play className="h-4 w-4 shrink-0" />
                  Resume Job
                </button>
              )}
              {isArchived ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void patchStatus("active");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <ArchiveRestore className="h-4 w-4 shrink-0" />
                  Unarchive Job
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void patchStatus("archived");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <Archive className="h-4 w-4 shrink-0" />
                  Archive Job
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDelete();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                Delete Job
              </button>
            </div>
          )}
        </div>
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
            {formatKartaDate(job.created_at)}
          </dd>
        </div>
      </dl>
      {job.inbound_email && (
        <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
          <Mail className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" />
          <span className="min-w-0 flex-1 truncate text-[11px] text-[#94A3B8]">
            {job.inbound_email}
          </span>
          <span onClick={(e) => e.stopPropagation()} role="presentation">
            <CopyButton
              text={job.inbound_email}
              label="Copy"
              className="relative z-10 shrink-0 !gap-1 text-[11px] [&_svg]:h-3 [&_svg]:w-3"
            />
          </span>
        </div>
      )}
    </li>
  );
}

export function JobsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceHint = searchParams.get("workspace_hint");
  const existingCompanyName = searchParams.get("company_name");
  const showExistingCompanyNotice =
    workspaceHint === "existing" &&
    Boolean(existingCompanyName?.trim());

  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [usage, setUsage] = useState<WorkspaceUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobFilter, setJobFilter] = useState<"active" | "all">("active");

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

  return (
    <div className="space-y-8">
      <div className="-mx-4 mb-2 border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-teal-50/30 px-4 py-6 sm:-mx-6 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className={karta.pageTitle}>Jobs</h1>
            {usage && (
              <p className="mt-1 text-xs text-[#94A3B8]">
                {isUnlimitedWorkspaceCap(usage.jobs.max)
                  ? `${usage.jobs.current} jobs · ${usage.candidates.current} candidates`
                  : `${usage.jobs.current} of ${usage.jobs.max} jobs · ${usage.candidates.current} candidates`}
              </p>
            )}
            <p className="mt-1 text-sm text-[#64748B]">
              Manage open roles, applicants, and shortlists in one place.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/jobs/new")}
            className={`inline-flex items-center gap-2 ${karta.btnPrimary}`}
          >
            <Plus className="h-4 w-4" />
            Post a Job
          </button>
        </div>
        <div className="mt-6">
          <DashboardStrip />
        </div>
      </div>

      {showExistingCompanyNotice && existingCompanyName && (
        <p
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          role="status"
        >
          {existingCompanySignupMessage(existingCompanyName)}
        </p>
      )}

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
        <EmptyState
          illustration="briefcase"
          heading="Post your first job"
          subtitle="Add a job description and Kharta will extract the role requirements automatically."
          action={
            <button
              type="button"
              onClick={() => router.push("/jobs/new")}
              className={`inline-flex items-center gap-2 ${karta.btnPrimary}`}
            >
              <Plus className="h-4 w-4" />
              Post a Job
            </button>
          }
        />
      ) : (
        <>
          <div id="job-cards" className="scroll-mt-6 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setJobFilter("active")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                jobFilter === "active"
                  ? "bg-[#0D9488] text-white"
                  : "bg-slate-100 text-[#64748B] hover:bg-slate-200"
              }`}
            >
              Active & Paused
            </button>
            <button
              type="button"
              onClick={() => setJobFilter("all")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                jobFilter === "all"
                  ? "bg-[#0D9488] text-white"
                  : "bg-slate-100 text-[#64748B] hover:bg-slate-200"
              }`}
            >
              All Jobs
            </button>
          </div>
          <ul className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {jobs
            .filter((job) =>
              jobFilter === "all"
                ? true
                : job.status === "active" || job.status === "paused",
            )
            .map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onReload={() => void loadJobs()}
                onError={setError}
              />
            ))}
          </ul>
          </div>
        </>
      )}

    </div>
  );
}
