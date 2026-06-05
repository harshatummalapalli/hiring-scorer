"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Link2,
  Loader2,
  Mail,
  Upload,
  X,
} from "lucide-react";
import { CopyButton } from "@/components/ui/copy-button";
import { JobLimitModal } from "@/components/workspace/job-limit-modal";
import { karta } from "@/lib/brand/karta";
import { getErrorMessage } from "@/lib/errors";
import { buildFullApplyUrl } from "@/lib/jobs/apply-url";
import {
  DEFAULT_WIZARD_WEIGHTS,
  GENERIC_SOFT_SKILLS,
  WIZARD_SENIORITY_OPTIONS,
  WORK_MODE_OPTIONS,
  WEIGHT_PRESETS,
  filterCannotAssessItems,
  formatWizardJobLocation,
  type WorkMode,
} from "@/lib/jobs/wizard-constants";
import { submitCandidateWithResume } from "@/lib/candidates/submit-candidate-upload";
import { jobPostingToJdContext } from "@/types/job-posting";
import { parseResumeFile } from "@/lib/resume/parse-resume";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { parseWorkspaceSettings } from "@/lib/workspace/settings";
import type { Job } from "@/types/job";
import {
  SENIORITY_LEVELS,
  type JobPostingFields,
  type SeniorityLevel,
} from "@/types/job-posting";
import type {
  RoleBriefAnalysis,
  RoleBriefAnalysisMeta,
  RoleBriefSuggestedWeights,
  TitleBand,
} from "@/types/role-brief";
import { emptyAnalysis } from "@/types/role-brief";

const STEP_LABELS = [
  "Basics",
  "Description",
  "Review",
  "Weights",
  "Ready",
] as const;

type WizardData = {
  title: string;
  company: string;
  location: string;
  workMode: WorkMode;
  seniorityBands: TitleBand[];
  jobDescription: string;
  analysisResult: RoleBriefAnalysis | null;
  analysisMeta: RoleBriefAnalysisMeta;
  mustHaves: string[];
  niceToHaves: string[];
  equivalentTitles: string[];
  cannotAssess: string[];
  weights: RoleBriefSuggestedWeights;
};

function initialWizardData(company = ""): WizardData {
  return {
    title: "",
    company,
    location: "",
    workMode: "on-site",
    seniorityBands: ["Senior"],
    jobDescription: "",
    analysisResult: null,
    analysisMeta: {
      job_description_hash: null,
      analysis_version: 1,
      last_analysed_at: null,
    },
    mustHaves: [],
    niceToHaves: [],
    equivalentTitles: [],
    cannotAssess: [],
    weights: { ...DEFAULT_WIZARD_WEIGHTS },
  };
}

function analysisFromWizard(data: WizardData): RoleBriefAnalysis {
  const base = data.analysisResult ?? emptyAnalysis();
  const primaryBand = data.seniorityBands[0] ?? base.title_band ?? "Mid";
  return {
    ...base,
    deal_breakers: base.deal_breakers ?? [],
    core_signals: data.mustHaves.map((skill) => ({
      skill,
      equivalents:
        base.core_signals.find(
          (c) => c.skill.toLowerCase() === skill.toLowerCase(),
        )?.equivalents ?? [],
    })),
    preferred_signals: [...data.niceToHaves],
    equivalent_titles: [...data.equivalentTitles],
    cannot_assess: [...data.cannotAssess],
    title_band: primaryBand,
    suggested_weights: { ...data.weights },
  };
}

function syncListsFromAnalysis(
  analysis: RoleBriefAnalysis,
  meta: Partial<RoleBriefAnalysisMeta>,
): Pick<
  WizardData,
  | "mustHaves"
  | "niceToHaves"
  | "equivalentTitles"
  | "cannotAssess"
  | "weights"
  | "analysisResult"
  | "analysisMeta"
> {
  return {
    analysisResult: analysis,
    analysisMeta: {
      job_description_hash: meta.job_description_hash ?? null,
      analysis_version: meta.analysis_version ?? 1,
      last_analysed_at: meta.last_analysed_at ?? null,
    },
    mustHaves: analysis.core_signals.map((c) => c.skill).filter(Boolean),
    niceToHaves: [...analysis.preferred_signals],
    equivalentTitles: [...analysis.equivalent_titles],
    cannotAssess: filterCannotAssessItems(analysis.cannot_assess),
    weights: analysis.suggested_weights
      ? { ...analysis.suggested_weights }
      : { ...DEFAULT_WIZARD_WEIGHTS },
  };
}

function WizardProgress({ step }: { step: number }) {
  return (
    <nav
      className="mb-8 flex flex-wrap items-center gap-0"
      aria-label="Job creation progress"
    >
      {STEP_LABELS.map((label, i) => {
        const index = i + 1;
        const done = step > index;
        const current = step === index;
        const future = step < index;
        return (
          <div key={label} className="flex items-center">
            {i > 0 && (
              <div
                className={`mx-1 h-px w-6 sm:w-10 ${
                  done || current ? "bg-[#0D9488]" : "bg-slate-200"
                }`}
                aria-hidden
              />
            )}
            <div className="flex items-center gap-1.5">
              <span
                className={`flex h-3 w-3 shrink-0 rounded-full border-2 ${
                  done || current
                    ? "border-[#0D9488] bg-[#0D9488]"
                    : "border-slate-300 bg-white"
                }`}
                aria-hidden
              />
              <span
                className={`text-xs sm:text-sm ${
                  current
                    ? "font-semibold text-[#1E293B]"
                    : future
                      ? "text-[#94A3B8]"
                      : "text-[#64748B]"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function WizardFooter({
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  nextLoading,
  showBack = true,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
  showBack?: boolean;
}) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6">
      {showBack && onBack ? (
        <button type="button" onClick={onBack} className={karta.btnSecondary}>
          ← Back
        </button>
      ) : (
        <Link href="/jobs" className={karta.btnSecondary}>
          Cancel
        </Link>
      )}
      <button
        type="button"
        disabled={nextDisabled || nextLoading}
        onClick={onNext}
        className={`ml-auto ${karta.btnPrimary}`}
      >
        {nextLoading ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {nextLabel}
          </span>
        ) : (
          nextLabel
        )}
      </button>
    </div>
  );
}

function PillList({
  items,
  onRemove,
  onAdd,
  addPlaceholder,
  variant,
}: {
  items: string[];
  onRemove: (index: number) => void;
  onAdd: (value: string) => void;
  addPlaceholder: string;
  variant: "teal" | "grey" | "title";
}) {
  const [draft, setDraft] = useState("");
  const pillClass =
    variant === "teal"
      ? "border-[#99F6E4] bg-[#F0FDFA] text-[#0F766E]"
      : variant === "title"
        ? "border-slate-200 bg-slate-50 text-[#475569]"
        : "border-slate-200 bg-slate-100 text-[#64748B]";

  const submit = () => {
    const v = draft.trim();
    if (!v) return;
    onAdd(v);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm ${pillClass}`}
          >
            {item}
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="rounded p-0.5 hover:bg-black/5"
              aria-label={`Remove ${item}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={addPlaceholder}
          className={`min-w-[140px] flex-1 ${karta.input} text-sm`}
        />
        <button
          type="button"
          onClick={submit}
          className={`${karta.btnOutlineTeal} text-sm`}
        >
          + Add
        </button>
      </div>
    </div>
  );
}

export function JobCreationWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [wizardData, setWizardData] = useState<WizardData>(() =>
    initialWizardData(),
  );
  const [titleError, setTitleError] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [analyseError, setAnalyseError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdJob, setCreatedJob] = useState<Job | null>(null);
  const [showJobLimitModal, setShowJobLimitModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: ws } = await supabase
        .from("workspace_settings")
        .select("company_name, settings")
        .eq("user_id", user.id)
        .maybeSingle();

      let company = "";
      if (ws) {
        const row = ws as { company_name?: string | null; settings?: unknown };
        company =
          String(row.company_name ?? "").trim() ||
          parseWorkspaceSettings(row.settings).company_name;
      }

      if (!company) {
        const { data: profile } = await supabase
          .from("workspace_profiles")
          .select("company_name")
          .eq("user_id", user.id)
          .maybeSingle();
        company = String(profile?.company_name ?? "").trim();
      }

      if (company) {
        setWizardData((d) => ({ ...d, company }));
      }
    })();
  }, []);

  const patch = useCallback((partial: Partial<WizardData>) => {
    setWizardData((d) => ({ ...d, ...partial }));
  }, []);

  const toggleBand = (band: TitleBand) => {
    setWizardData((d) => {
      const has = d.seniorityBands.includes(band);
      const next = has
        ? d.seniorityBands.filter((b) => b !== band)
        : [...d.seniorityBands, band];
      return {
        ...d,
        seniorityBands: next.length > 0 ? next : [band],
      };
    });
  };

  const buildJobPosting = (): JobPostingFields => {
    const primary = wizardData.seniorityBands[0] ?? "Mid";
    const seniorityOverride = (SENIORITY_LEVELS as readonly string[]).includes(
      primary,
    )
      ? (primary as SeniorityLevel)
      : "Mid";
    return {
      jobTitle: wizardData.title.trim(),
      jobLocation: formatWizardJobLocation(
        wizardData.location,
        wizardData.workMode,
      ),
      titleBands: wizardData.seniorityBands,
      seniorityOverride,
      clientCompanyName: wizardData.company.trim() || undefined,
    };
  };

  const runAnalyse = async () => {
    if (!wizardData.jobDescription.trim()) return;
    setAnalysing(true);
    setAnalyseError(null);
    try {
      const res = await fetch("/api/analyse-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription: wizardData.jobDescription.trim(),
          recruiterContext: jobPostingToJdContext(buildJobPosting()),
        }),
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error("Unexpected server response. Please try again.");
      }
      const data = (await res.json()) as {
        error?: string;
        analysis?: RoleBriefAnalysis;
        job_description_hash?: string;
        analysis_version?: number;
        last_analysed_at?: string | null;
      };
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");

      const analysis = data.analysis ?? emptyAnalysis();
      setWizardData((d) => ({
        ...d,
        ...syncListsFromAnalysis(analysis, {
          job_description_hash: data.job_description_hash,
          analysis_version: data.analysis_version,
          last_analysed_at: data.last_analysed_at,
        }),
      }));
      setStep(3);
    } catch (err) {
      setAnalyseError(
        "Could not analyse this description. Please try again or proceed manually.",
      );
    } finally {
      setAnalysing(false);
    }
  };

  const skipToManualReview = () => {
    setAnalyseError(null);
    setWizardData((d) => ({
      ...d,
      analysisResult: null,
      mustHaves: [],
      niceToHaves: [],
      equivalentTitles: [],
      cannotAssess: [],
      weights: { ...DEFAULT_WIZARD_WEIGHTS },
    }));
    setStep(3);
  };

  const createJob = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const analysis = analysisFromWizard(wizardData);
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: wizardData.title.trim(),
          jobDescription: wizardData.jobDescription.trim(),
          analysis,
          analysisMeta: wizardData.analysisMeta,
          jobPosting: buildJobPosting(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "JOB_LIMIT_REACHED") {
          setShowJobLimitModal(true);
          return;
        }
        throw new Error(json.error ?? "Failed to create job");
      }
      setCreatedJob(json.job as Job);
      setStep(5);
    } catch (err) {
      setCreateError(getErrorMessage(err, "Failed to create job"));
    } finally {
      setCreating(false);
    }
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files?.length || !createdJob) return;
    setUploading(true);
    setCreateError(null);
    try {
      for (const file of Array.from(files)) {
        const resumeText = await parseResumeFile(file);
        const res = await submitCandidateWithResume({
          resumeText,
          resumeFilename: file.name,
          resumeFile: file,
          jobId: createdJob.id,
          source: "uploaded",
        });
        if (!res.ok) {
          const json = await res.json();
          if (json.id) continue;
          throw new Error(json.error ?? "Upload failed");
        }
      }
      router.push(`/jobs/${createdJob.id}`);
    } catch (err) {
      setCreateError(getErrorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const applyUrl = createdJob
    ? buildFullApplyUrl(createdJob.apply_link, createdJob.application_token)
    : "";
  const inboundEmail = createdJob?.inbound_email ?? "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <WizardProgress step={step} />

      {createError && step !== 5 && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {createError}
        </p>
      )}

      {step === 1 && (
        <section className={`${karta.card} p-6 sm:p-8`}>
          <h1 className={karta.pageTitle}>What role are you hiring for?</h1>
          <p className="mt-2 text-sm text-[#64748B]">
            Start with the essentials. You can always edit later.
          </p>

          <div className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-[#334155]">
              Job title
              <input
                type="text"
                required
                placeholder="e.g. Senior AI Engineer"
                value={wizardData.title}
                onChange={(e) => {
                  setTitleError(null);
                  patch({ title: e.target.value });
                }}
                className={`mt-1 w-full ${karta.input}`}
              />
              {titleError && (
                <p className="mt-1 text-sm text-red-600">{titleError}</p>
              )}
            </label>

            <label className="block text-sm font-medium text-[#334155]">
              Company name
              <input
                type="text"
                placeholder="e.g. Acme Corp"
                value={wizardData.company}
                onChange={(e) => patch({ company: e.target.value })}
                className={`mt-1 w-full ${karta.input}`}
              />
            </label>

            <label className="block text-sm font-medium text-[#334155]">
              Location
              <input
                type="text"
                placeholder="Start typing a city..."
                value={wizardData.location}
                onChange={(e) => patch({ location: e.target.value })}
                className={`mt-1 w-full ${karta.input}`}
              />
            </label>

            <div>
              <span className="block text-sm font-medium text-[#334155]">
                Work mode
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {WORK_MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => patch({ workMode: opt.id })}
                    className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                      wizardData.workMode === opt.id
                        ? "border-[#0D9488] bg-[#0D9488] text-white"
                        : "border-slate-200 bg-white text-[#64748B] hover:border-[#0D9488]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium text-[#334155]">
                Seniority band
                <span className="ml-1 font-normal text-[#94A3B8]">
                  (select one or more)
                </span>
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {WIZARD_SENIORITY_OPTIONS.map(({ label, band }) => (
                  <button
                    key={band}
                    type="button"
                    onClick={() => toggleBand(band)}
                    className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                      wizardData.seniorityBands.includes(band)
                        ? "border-[#0D9488] bg-[#0D9488] text-white"
                        : "border-slate-200 bg-white text-[#64748B] hover:border-[#0D9488]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <WizardFooter
            showBack={false}
            onNext={() => {
              if (!wizardData.title.trim()) {
                setTitleError("Job title is required.");
                return;
              }
              setTitleError(null);
              setStep(2);
            }}
            nextLabel="Next →"
          />
        </section>
      )}

      {step === 2 && (
        <section className={`${karta.card} p-6 sm:p-8`}>
          <h1 className={karta.pageTitle}>Describe the role</h1>
          <p className="mt-2 text-sm text-[#64748B]">
            Paste your JD or describe what this person will do. Kharta will
            extract the key requirements automatically.
          </p>

          <textarea
            rows={12}
            placeholder="Paste your job description here, or describe the role in your own words..."
            value={wizardData.jobDescription}
            onChange={(e) => patch({ jobDescription: e.target.value })}
            className={`mt-6 w-full text-sm ${karta.input}`}
          />
          <p className="mt-3 text-xs text-[#94A3B8]">
            Tip: The more detail you provide, the better Kharta can identify
            must-have skills and evaluate candidates.
          </p>

          {analyseError && (
            <div
              className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
              role="alert"
            >
              <p>{analyseError}</p>
              <button
                type="button"
                onClick={skipToManualReview}
                className="mt-2 font-medium text-[#0D9488] hover:underline"
              >
                Skip analysis →
              </button>
            </div>
          )}

          <WizardFooter
            onBack={() => setStep(1)}
            onNext={() => void runAnalyse()}
            nextLabel={analysing ? "Analysing..." : "Analyse role →"}
            nextLoading={analysing}
            nextDisabled={!wizardData.jobDescription.trim() || analysing}
          />
        </section>
      )}

      {step === 3 && (
        <section className={`${karta.card} p-6 sm:p-8`}>
          <h1 className={karta.pageTitle}>Here&apos;s what Kharta found</h1>
          <p className="mt-2 text-sm text-[#64748B]">
            Review and adjust the requirements. These determine how candidates
            are scored.
          </p>

          <div className="mt-8 space-y-8">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[#64748B]">
                Must-have skills
              </h2>
              <div className="mt-3">
                <PillList
                  items={wizardData.mustHaves}
                  variant="teal"
                  addPlaceholder="Add skill"
                  onRemove={(i) =>
                    patch({
                      mustHaves: wizardData.mustHaves.filter((_, j) => j !== i),
                    })
                  }
                  onAdd={(v) => {
                    if (
                      wizardData.mustHaves.some(
                        (s) => s.toLowerCase() === v.toLowerCase(),
                      )
                    )
                      return;
                    patch({ mustHaves: [...wizardData.mustHaves, v] });
                  }}
                />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[#64748B]">
                Nice-to-have skills
              </h2>
              <div className="mt-3">
                <PillList
                  items={wizardData.niceToHaves}
                  variant="grey"
                  addPlaceholder="Add skill"
                  onRemove={(i) =>
                    patch({
                      niceToHaves: wizardData.niceToHaves.filter(
                        (_, j) => j !== i,
                      ),
                    })
                  }
                  onAdd={(v) => {
                    if (
                      wizardData.niceToHaves.some(
                        (s) => s.toLowerCase() === v.toLowerCase(),
                      )
                    )
                      return;
                    patch({ niceToHaves: [...wizardData.niceToHaves, v] });
                  }}
                />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[#64748B]">
                Equivalent titles
              </h2>
              <div className="mt-3">
                <PillList
                  items={wizardData.equivalentTitles}
                  variant="title"
                  addPlaceholder="Add title"
                  onRemove={(i) =>
                    patch({
                      equivalentTitles: wizardData.equivalentTitles.filter(
                        (_, j) => j !== i,
                      ),
                    })
                  }
                  onAdd={(v) => {
                    if (
                      wizardData.equivalentTitles.some(
                        (s) => s.toLowerCase() === v.toLowerCase(),
                      )
                    )
                      return;
                    patch({
                      equivalentTitles: [...wizardData.equivalentTitles, v],
                    });
                  }}
                />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[#64748B]">
                Verify in interview
              </h2>
              <p className="mt-1 text-xs text-[#94A3B8]">
                Up to 5 items that cannot be assessed from a resume alone.
              </p>
              <ul className="mt-3 space-y-2">
                {wizardData.cannotAssess.map((item, i) => (
                  <li
                    key={`${item}-${i}`}
                    className="flex items-start gap-2 text-sm text-[#334155]"
                  >
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#0D9488]"
                      aria-hidden
                    />
                    <span className="flex-1">{item}</span>
                    <button
                      type="button"
                      onClick={() =>
                        patch({
                          cannotAssess: wizardData.cannotAssess.filter(
                            (_, j) => j !== i,
                          ),
                        })
                      }
                      className="text-[#94A3B8] hover:text-red-600"
                      aria-label={`Remove ${item}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              {wizardData.cannotAssess.length < 5 && (
                <CannotAssessAdd
                  onAdd={(v) => {
                    if (wizardData.cannotAssess.length >= 5) return;
                    if (
                      wizardData.cannotAssess.some(
                        (s) => s.toLowerCase() === v.toLowerCase(),
                      )
                    )
                      return;
                    if (GENERIC_SOFT_SKILLS.has(v.toLowerCase())) return;
                    patch({
                      cannotAssess: [...wizardData.cannotAssess, v],
                    });
                  }}
                />
              )}
            </div>
          </div>

          <WizardFooter
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
            nextLabel="Next →"
          />
        </section>
      )}

      {step === 4 && (
        <section className={`${karta.card} p-6 sm:p-8`}>
          <h1 className={karta.pageTitle}>
            How should Kharta weigh each dimension?
          </h1>
          <p className="mt-2 text-sm text-[#64748B]">
            Adjust the importance of each factor. Higher weight = more impact on
            the final score.
          </p>

          <div className="mt-6 space-y-5">
            {(
              [
                ["weight_skills", "Technical skills match"],
                ["weight_trajectory", "Career growth pattern"],
                ["weight_domain", "Industry experience"],
                ["weight_seniority", "Seniority level"],
                ["weight_tenure", "Job stability"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-[#334155]">{label}</span>
                  <span className="tabular-nums font-semibold text-[#0D9488]">
                    {wizardData.weights[key]}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={wizardData.weights[key]}
                  onChange={(e) =>
                    patch({
                      weights: {
                        ...wizardData.weights,
                        [key]: Number(e.target.value),
                      },
                    })
                  }
                  className="mt-2 w-full accent-[#0D9488]"
                />
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {(
              [
                ["technical", "Technical-heavy"],
                ["leadership", "Leadership-heavy"],
                ["balanced", "Balanced"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() =>
                  patch({ weights: { ...WEIGHT_PRESETS[id] } })
                }
                className={`${karta.btnOutlineTeal} text-sm`}
              >
                {label}
              </button>
            ))}
          </div>

          <WizardFooter
            onBack={() => setStep(3)}
            onNext={() => void createJob()}
            nextLabel={creating ? "Creating..." : "Create job →"}
            nextLoading={creating}
            nextDisabled={creating}
          />
        </section>
      )}

      {step === 5 && createdJob && (
        <section className={`${karta.card} p-6 sm:p-8`}>
          <div className="flex items-start gap-3">
            <CheckCircle2
              className="h-10 w-10 shrink-0 text-[#0D9488]"
              aria-hidden
            />
            <div>
              <h1 className={karta.pageTitle}>Your role is live</h1>
              <p className="mt-2 text-sm text-[#64748B]">
                Start adding candidates to see Kharta&apos;s evaluation in
                action.
              </p>
              <p className="mt-2 text-base font-semibold text-[#1E293B]">
                {createdJob.title}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-1">
            <div className="rounded-lg border border-slate-200 p-4">
              <Upload className="h-6 w-6 text-[#0D9488]" aria-hidden />
              <p className="mt-2 text-sm font-medium text-[#1E293B]">
                Upload resumes
              </p>
              <p className="mt-1 text-xs text-[#64748B]">
                Drag and drop PDFs or click to browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                multiple
                className="sr-only"
                onChange={(e) => {
                  void handleUploadFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className={`mt-3 ${karta.btnOutlineTeal} text-sm`}
              >
                {uploading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading…
                  </span>
                ) : (
                  "Upload files"
                )}
              </button>
            </div>

            {inboundEmail && (
              <div className="rounded-lg border border-slate-200 p-4">
                <Mail className="h-6 w-6 text-[#0D9488]" aria-hidden />
                <p className="mt-2 text-sm font-medium text-[#1E293B]">
                  Share apply email
                </p>
                <p className="mt-1 break-all text-xs text-[#64748B]">
                  {inboundEmail}
                </p>
                <p className="mt-2 text-xs text-[#94A3B8]">
                  Forward this to candidates or paste it in your job posting
                </p>
                <div className="mt-3">
                  <CopyButton text={inboundEmail} label="Copy email" />
                </div>
              </div>
            )}

            {applyUrl && (
              <div className="rounded-lg border border-slate-200 p-4">
                <Link2 className="h-6 w-6 text-[#0D9488]" aria-hidden />
                <p className="mt-2 text-sm font-medium text-[#1E293B]">
                  Share apply link
                </p>
                <p className="mt-1 break-all text-xs text-[#64748B]">
                  {applyUrl}
                </p>
                <p className="mt-2 text-xs text-[#94A3B8]">
                  Candidates can apply directly through this link
                </p>
                <div className="mt-3">
                  <CopyButton text={applyUrl} label="Copy link" />
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 border-t border-slate-100 pt-6">
            <button
              type="button"
              onClick={() => router.push(`/jobs/${createdJob.id}`)}
              className={`w-full sm:w-auto ${karta.btnPrimary}`}
            >
              Go to pipeline →
            </button>
          </div>
        </section>
      )}

      <JobLimitModal
        open={showJobLimitModal}
        onClose={() => setShowJobLimitModal(false)}
      />
    </div>
  );
}

function CannotAssessAdd({ onAdd }: { onAdd: (value: string) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const v = draft.trim();
            if (v) onAdd(v);
            setDraft("");
          }
        }}
        placeholder="Add item"
        className={`min-w-[140px] flex-1 ${karta.input} text-sm`}
      />
      <button
        type="button"
        onClick={() => {
          const v = draft.trim();
          if (v) onAdd(v);
          setDraft("");
        }}
        className={`${karta.btnOutlineTeal} text-sm`}
      >
        + Add item
      </button>
    </div>
  );
}
