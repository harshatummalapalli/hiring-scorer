"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { AnalysisCards } from "@/components/role-briefs/analysis-cards";
import { JobOverviewCalibrate } from "@/components/jobs/tabs/job-overview-calibrate";
import { JdAnalysisLoading } from "@/components/role-briefs/jd-analysis-loading";
import { karta } from "@/lib/brand/karta";
import { getErrorMessage } from "@/lib/errors";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { JdSessionCache } from "@/lib/role-brief/resolve-jd-analysis";
import {
  COMPANY_SIZE_OPTIONS,
  type CompanySize,
  type RecruiterType,
} from "@/lib/workspace/workspace-profiles";
import {
  briefRowToJobPosting,
  jobPostingToJdContext,
  SENIORITY_LEVELS,
  type JobPostingFields,
  type SeniorityLevel,
} from "@/types/job-posting";
import type { Job } from "@/types/job";
import type {
  RoleBrief,
  RoleBriefAnalysis,
  RoleBriefAnalysisMeta,
} from "@/types/role-brief";
import {
  analysisFromRoleBrief,
  deriveTitleFromAnalysis,
  emptyAnalysis,
} from "@/types/role-brief";

type SavePayload = {
  title: string;
  jobDescription: string;
  analysis: RoleBriefAnalysis;
  analysisMeta: RoleBriefAnalysisMeta;
  jobPosting: JobPostingFields;
};

type RoleBriefCreatorProps = {
  initialJobDescription?: string;
  initialAnalysis?: RoleBriefAnalysis | null;
  initialTitle?: string;
  initialJobPosting?: Partial<JobPostingFields>;
  initialAnalysisMeta?: RoleBriefAnalysisMeta | null;
  initialAnalysedJobDescription?: string;
  editingId?: string | null;
  job?: Job | null;
  onJobUpdated?: (job: Job) => void;
  onSave: (data: SavePayload) => Promise<void>;
  isSaving: boolean;
  onCancel?: () => void;
};

type FieldErrors = Partial<
  Record<
    | "jobTitle"
    | "jobLocation"
    | "seniority"
    | "clientCompanyName"
    | "clientCompanyBrief"
    | "form",
    string
  >
>;

export function RoleBriefCreator({
  initialJobDescription = "",
  initialAnalysis = null,
  initialTitle = "",
  initialJobPosting,
  initialAnalysisMeta = null,
  initialAnalysedJobDescription = "",
  editingId = null,
  job = null,
  onJobUpdated,
  onSave,
  isSaving,
  onCancel,
}: RoleBriefCreatorProps) {
  const [jobDescription, setJobDescription] = useState(initialJobDescription);
  const [analysis, setAnalysis] = useState<RoleBriefAnalysis | null>(
    initialAnalysis,
  );
  const [title, setTitle] = useState(initialTitle);
  const [jobTitle, setJobTitle] = useState(
    initialJobPosting?.jobTitle ?? initialTitle,
  );
  const [jobLocation, setJobLocation] = useState(
    initialJobPosting?.jobLocation ?? "",
  );
  const [seniority, setSeniority] = useState<SeniorityLevel>(
    initialJobPosting?.seniorityOverride ?? "Mid",
  );
  const [department, setDepartment] = useState(initialJobPosting?.department ?? "");
  const [recruiterType, setRecruiterType] = useState<RecruiterType>("inhouse");
  const [clientContextOpen, setClientContextOpen] = useState(false);
  const [clientCompanyName, setClientCompanyName] = useState(
    initialJobPosting?.clientCompanyName ?? "",
  );
  const [clientCompanyBrief, setClientCompanyBrief] = useState(
    initialJobPosting?.clientCompanyBrief ?? "",
  );
  const [clientCompanySize, setClientCompanySize] = useState<CompanySize | "">(
    initialJobPosting?.clientCompanySize ?? "",
  );
  const [clientCompanyWebsite, setClientCompanyWebsite] = useState(
    initialJobPosting?.clientCompanyWebsite ?? "",
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [analysisMeta, setAnalysisMeta] = useState<RoleBriefAnalysisMeta>(() => ({
    job_description_hash: initialAnalysisMeta?.job_description_hash ?? null,
    analysis_version: initialAnalysisMeta?.analysis_version ?? 1,
    last_analysed_at: initialAnalysisMeta?.last_analysed_at ?? null,
  }));
  const [analysedJobDescription, setAnalysedJobDescription] = useState(
    initialAnalysedJobDescription || initialJobDescription,
  );

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data, error: profileError } = await supabase
          .from("workspace_profiles")
          .select(
            "recruiter_type, company_name, company_size, company_website",
          )
          .eq("user_id", user.id)
          .maybeSingle();
        if (profileError || !data) return;

        const type = data.recruiter_type === "agency" ? "agency" : "inhouse";
        setRecruiterType(type);
        setClientContextOpen(type === "agency");

        if (!initialJobPosting?.clientCompanyName && type === "inhouse") {
          setClientCompanyName(String(data.company_name ?? ""));
          if (!initialJobPosting?.clientCompanySize && data.company_size) {
            setClientCompanySize(data.company_size as CompanySize);
          }
          if (!initialJobPosting?.clientCompanyWebsite && data.company_website) {
            setClientCompanyWebsite(String(data.company_website));
          }
        }
      } catch {
        /* workspace_profiles may not exist until migration runs */
      }
    })();
  }, [initialJobPosting?.clientCompanyName, initialJobPosting?.clientCompanySize, initialJobPosting?.clientCompanyWebsite]);

  const buildJobPosting = (): JobPostingFields => ({
    jobTitle: jobTitle.trim(),
    jobLocation: jobLocation.trim(),
    seniorityOverride: seniority,
    department: department.trim() || undefined,
    clientCompanyName: clientCompanyName.trim() || undefined,
    clientCompanyBrief: clientCompanyBrief.trim() || undefined,
    clientCompanySize: clientCompanySize || undefined,
    clientCompanyWebsite: clientCompanyWebsite.trim() || undefined,
  });

  const validatePosting = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!jobTitle.trim()) next.jobTitle = "Job title is required.";
    if (!jobLocation.trim()) next.jobLocation = "Job location is required.";
    if (!seniority) next.seniority = "Seniority level is required.";
    if (!clientCompanyName.trim()) {
      next.clientCompanyName = "Hiring company name is required.";
    }
    if (clientCompanyBrief.length > 300) {
      next.clientCompanyBrief = "Company brief must be 300 characters or fewer.";
    }
    return next;
  };

  const handleAnalyse = async () => {
    const postingErrors = validatePosting();
    if (!jobDescription.trim()) {
      setError("Paste a job description first.");
      return;
    }
    if (Object.keys(postingErrors).length > 0) {
      setFieldErrors(postingErrors);
      setError("Complete the job fields above before reading the JD.");
      return;
    }

    setAnalysing(true);
    setError(null);
    setInfoMessage(null);
    setFieldErrors({});

    try {
      const sessionCache: JdSessionCache | null =
        analysis && analysedJobDescription.trim()
          ? {
              job_description: analysedJobDescription.trim(),
              analysis,
              deal_breakers: analysis.deal_breakers,
              core_signals: analysis.core_signals,
              preferred_signals: analysis.preferred_signals,
              semantic_clusters: analysis.semantic_clusters,
              analysis_version: analysisMeta.analysis_version ?? 1,
              last_analysed_at: analysisMeta.last_analysed_at ?? null,
              job_description_hash: analysisMeta.job_description_hash ?? null,
            }
          : null;

      const res = await fetch("/api/analyse-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription: jobDescription.trim(),
          roleBriefId: editingId ?? undefined,
          sessionCache,
          recruiterContext: jobPostingToJdContext(buildJobPosting()),
        }),
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          "Server returned an unexpected response. Sign in again and retry Read JD.",
        );
      }
      const data = (await res.json()) as {
        error?: string;
        analysis?: RoleBriefAnalysis;
        title?: string;
        fromCache?: boolean;
        job_description_hash?: string;
        analysis_version?: number;
        last_analysed_at?: string | null;
      };
      if (!res.ok) throw new Error(data.error ?? "Read JD failed");

      const next = data.analysis ?? emptyAnalysis();
      setAnalysis(next);
      const derived =
        data.title ?? deriveTitleFromAnalysis(next, jobDescription);
      setTitle(derived);
      if (!jobTitle.trim()) setJobTitle(derived);
      setAnalysisMeta({
        job_description_hash: data.job_description_hash ?? null,
        analysis_version: data.analysis_version ?? 1,
        last_analysed_at: data.last_analysed_at ?? null,
      });
      setAnalysedJobDescription(jobDescription.trim());

      if (data.fromCache) {
        setInfoMessage("Analysis unchanged — using existing JD breakdown.");
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to read job description"));
    } finally {
      setAnalysing(false);
    }
  };

  const handleSave = async () => {
    const postingErrors = validatePosting();
    setFieldErrors(postingErrors);
    if (Object.keys(postingErrors).length > 0) return;

    if (!analysis) {
      setError("Read the job description before saving.");
      return;
    }

    const finalTitle =
      jobTitle.trim() || title.trim() || deriveTitleFromAnalysis(analysis, jobDescription);
    if (!finalTitle) {
      setFieldErrors({ jobTitle: "Job title is required." });
      return;
    }

    setError(null);
    await onSave({
      title: finalTitle,
      jobDescription: jobDescription.trim(),
      analysis,
      analysisMeta: {
        ...analysisMeta,
        job_description_hash: analysisMeta.job_description_hash ?? null,
      },
      jobPosting: buildJobPosting(),
    });
  };

  return (
    <div className="space-y-10">
      <section className={`${karta.card} p-8 sm:p-10`}>
        <div className="space-y-4">
          <label className="block text-sm font-medium text-[#334155]">
            Job Title
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className={`mt-1 w-full ${karta.input}`}
              disabled={analysing}
            />
            {fieldErrors.jobTitle && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.jobTitle}</p>
            )}
          </label>

          <label className="block text-sm font-medium text-[#334155]">
            Job Location
            <input
              type="text"
              value={jobLocation}
              onChange={(e) => setJobLocation(e.target.value)}
              placeholder="e.g. Bangalore / Remote / Hybrid - Mumbai"
              className={`mt-1 w-full ${karta.input}`}
              disabled={analysing}
            />
            {fieldErrors.jobLocation && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.jobLocation}</p>
            )}
          </label>

          <label className="block text-sm font-medium text-[#334155]">
            Seniority Level
            <select
              value={seniority}
              onChange={(e) =>
                setSeniority(e.target.value as SeniorityLevel)
              }
              className={`mt-1 w-full ${karta.input}`}
              disabled={analysing}
            >
              {SENIORITY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
            {fieldErrors.seniority && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.seniority}</p>
            )}
          </label>

          <label className="block text-sm font-medium text-[#334155]">
            Department{" "}
            <span className="font-normal text-[#94A3B8]">(optional)</span>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className={`mt-1 w-full ${karta.input}`}
              disabled={analysing}
            />
          </label>

          <div className="rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setClientContextOpen((o) => !o)}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-[#1E293B]"
              aria-expanded={clientContextOpen}
            >
              {clientContextOpen ? (
                <ChevronDown className="h-4 w-4 text-[#64748B]" />
              ) : (
                <ChevronRight className="h-4 w-4 text-[#64748B]" />
              )}
              Client / Company Context
            </button>
            {clientContextOpen && (
              <div className="space-y-4 border-t border-slate-100 px-4 pb-4 pt-3">
                <label className="block text-sm font-medium text-[#334155]">
                  Hiring company name
                  <input
                    type="text"
                    value={clientCompanyName}
                    onChange={(e) => setClientCompanyName(e.target.value)}
                    className={`mt-1 w-full ${karta.input}`}
                    disabled={analysing}
                  />
                  {fieldErrors.clientCompanyName && (
                    <p className="mt-1 text-sm text-red-600">
                      {fieldErrors.clientCompanyName}
                    </p>
                  )}
                </label>

                <label className="block text-sm font-medium text-[#334155]">
                  Brief about the company
                  <textarea
                    value={clientCompanyBrief}
                    onChange={(e) => setClientCompanyBrief(e.target.value)}
                    maxLength={300}
                    rows={3}
                    placeholder="e.g. Series B fintech startup building payment infrastructure for SMEs in Southeast Asia"
                    className={`mt-1 w-full resize-y ${karta.input}`}
                    disabled={analysing}
                  />
                  {fieldErrors.clientCompanyBrief && (
                    <p className="mt-1 text-sm text-red-600">
                      {fieldErrors.clientCompanyBrief}
                    </p>
                  )}
                </label>

                <label className="block text-sm font-medium text-[#334155]">
                  Company size
                  <select
                    value={clientCompanySize}
                    onChange={(e) =>
                      setClientCompanySize(e.target.value as CompanySize | "")
                    }
                    className={`mt-1 w-full ${karta.input}`}
                    disabled={analysing}
                  >
                    <option value="">Select size</option>
                    {COMPANY_SIZE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm font-medium text-[#334155]">
                  Company website{" "}
                  <span className="font-normal text-[#94A3B8]">(optional)</span>
                  <input
                    type="text"
                    value={clientCompanyWebsite}
                    onChange={(e) => setClientCompanyWebsite(e.target.value)}
                    className={`mt-1 w-full ${karta.input}`}
                    disabled={analysing}
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleAnalyse()}
            disabled={analysing || !jobDescription.trim()}
            className={`inline-flex items-center gap-2 ${karta.btnPrimary} px-8 py-3 text-base disabled:opacity-70`}
          >
            {analysing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Analysing JD
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Read JD
              </>
            )}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={analysing || isSaving}
              className={karta.btnSecondary}
            >
              Cancel
            </button>
          )}

          <JdAnalysisLoading active={analysing} />

          {infoMessage && !analysing && (
            <p
              className="mt-4 rounded-md border border-[#0D9488]/30 bg-teal-50 px-3 py-2 text-sm text-[#0F766E]"
              role="status"
            >
              {infoMessage}
            </p>
          )}
          {error && !analysing && (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>

        {analysis && !analysing && (
          <p className="mt-4 text-sm text-slate-500">
            Review and edit the extracted signals below, then save.
          </p>
        )}

        <div
          className={`mt-6 grid gap-6 ${analysis ? "lg:grid-cols-2" : "grid-cols-1"} items-start`}
        >
          <div>
            <label
              htmlFor="job-description"
              className="block text-sm font-medium text-[#334155]"
            >
              Job Description
              <textarea
                id="job-description"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={14}
                placeholder="Paste the complete job description here — include the title, responsibilities, requirements, and any context about the team or company."
                className={`mt-1 w-full resize-y ${karta.input} leading-relaxed`}
                disabled={analysing}
              />
            </label>
          </div>

          {analysis && !analysing && (
            <div className="space-y-4 lg:max-h-[70vh] lg:overflow-y-auto lg:pr-1">
              <label className="block text-sm font-medium text-[#334155]">
                Requirements & Hiring Bar
              </label>
              <AnalysisCards
                analysis={analysis}
                onChange={setAnalysis}
                extractedTitle={title}
                onTitleChange={setTitle}
              />
              {job && onJobUpdated ? (
                <JobOverviewCalibrate job={job} onJobUpdated={onJobUpdated} />
              ) : null}
            </div>
          )}
        </div>
      </section>

      {analysis && !analysing && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-8">
            <p className="text-sm text-[#64748B]">
              {editingId ? "Update this job role." : "Save as a new job role."}
            </p>
            <div className="flex flex-wrap gap-3">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isSaving}
                  className={karta.btnSecondary}
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
                className={`inline-flex items-center gap-2 ${karta.btnPrimary} px-8 py-3 text-base`}
              >
                {isSaving && <Loader2 className="h-5 w-5 animate-spin" />}
                {isSaving ? "Saving…" : "Save Job Role"}
              </button>
            </div>
        </div>
      )}
    </div>
  );
}

/** Hydrate creator when editing an existing brief. */
export function roleBriefToCreatorState(brief: RoleBrief) {
  const row = brief as unknown as Record<string, unknown>;
  return {
    jobDescription: brief.job_description ?? "",
    analysis: analysisFromRoleBrief(brief),
    title: brief.title,
    jobPosting: briefRowToJobPosting(row, brief.title),
    analysisMeta: {
      job_description_hash: brief.job_description_hash,
      analysis_version: brief.analysis_version,
      last_analysed_at: brief.last_analysed_at,
    },
    analysedJobDescription: brief.job_description ?? "",
  };
}
