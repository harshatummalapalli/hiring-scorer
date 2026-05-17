"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import { RoleBriefCreator } from "@/components/role-briefs/role-brief-creator";
import { karta } from "@/lib/brand/karta";
import { getErrorMessage } from "@/lib/errors";
import {
  buildFullBriefPayload,
  buildLegacyBriefPayload,
  isMissingJobArchitectureColumnError,
  isMissingScoringPromptColumnError,
  isMissingV2ColumnError,
  stripJobArchitectureColumns,
  stripScoringPromptColumns,
} from "@/lib/role-brief/insert-brief-payload";
import {
  getAuthenticatedUserId,
  withCreatedBy,
} from "@/lib/supabase/created-by";
import { createSupabaseClient } from "@/lib/supabase/client";
import type { JobListItem } from "@/types/job";
import { JOB_STATUS_LABELS } from "@/types/job";
import type { RoleBriefAnalysis, RoleBriefScoringPrompt } from "@/types/role-brief";
import { parseRoleBriefRow } from "@/types/role-brief";
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

export function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPost, setShowPost] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/jobs");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load jobs");
      setJobs(json.jobs as JobListItem[]);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load jobs"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const handleSaveNewJob = async (data: {
    title: string;
    jobDescription: string;
    analysis: RoleBriefAnalysis;
    scoringPrompt: RoleBriefScoringPrompt;
  }) => {
    setIsSaving(true);
    setError(null);
    try {
      const supabase = createSupabaseClient();
      const userId = await getAuthenticatedUserId(supabase);
      let row: Record<string, unknown> = withCreatedBy(
        buildFullBriefPayload(
          data.title,
          data.jobDescription,
          data.analysis,
          data.scoringPrompt,
          true,
        ),
        userId,
      );
      let result = await supabase.from("role_briefs").insert(row).select().single();
      if (result.error) {
        let msg = result.error.message;
        if (isMissingJobArchitectureColumnError(msg)) {
          row = stripJobArchitectureColumns(row);
          result = await supabase.from("role_briefs").insert(row).select().single();
          msg = result.error?.message ?? "";
        }
        if (result.error && isMissingScoringPromptColumnError(msg)) {
          row = stripScoringPromptColumns(row);
          result = await supabase.from("role_briefs").insert(row).select().single();
        }
        if (result.error && isMissingV2ColumnError(result.error.message)) {
          result = await supabase
            .from("role_briefs")
            .insert(buildLegacyBriefPayload(data.title, data.jobDescription, data.analysis))
            .select()
            .single();
        }
      }
      if (result.error) throw result.error;
      const saved = parseRoleBriefRow(result.data as Record<string, unknown>);
      setShowPost(false);
      router.push(`/jobs/${saved.id}`);
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
    </div>
  );
}
