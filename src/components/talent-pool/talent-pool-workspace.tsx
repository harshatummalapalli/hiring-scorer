"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Search,
  Upload,
  Users,
  X,
} from "lucide-react";
import { CandidateIdentityCard } from "@/components/candidates/candidate-identity-card";
import { CoreStrengthLabel } from "@/components/candidates/core-strength-label";
import { ScoreRolePickerModal } from "@/components/candidates/score-role-picker-modal";
import { VerdictBadge } from "@/components/candidates/profile-shared";
import {
  ResumeUploadProgress,
  type ResumeUploadFileItem,
} from "@/components/jobs/resume-upload-progress";
import { EmptyState } from "@/components/ui/empty-state";
import { useCandidatePanel } from "@/contexts/candidate-panel-context";
import { useActiveRoleBrief } from "@/contexts/active-role-brief-context";
import { topSkillsForDisplay } from "@/lib/candidates/candidate-identity-display";
import {
  candidateHasGithub,
  filterCandidates,
  matchesCoreStrengthFilter,
  matchesSourceFilter,
  sortCandidates,
} from "@/lib/candidates/list-filters";
import { getPrimaryRoleScore } from "@/lib/candidates/active-role-score";
import { CANDIDATE_VERDICT_FILTER_OPTIONS } from "@/lib/candidates/verdict-filter-options";
import { ResumeDropZone } from "@/components/candidates/resume-drop-zone";
import { ResumeUploadFileHint } from "@/components/candidates/resume-upload-file-hint";
import { isStuckCandidate } from "@/lib/candidates/stuck-processing";
import { submitCandidateWithResume } from "@/lib/candidates/submit-candidate-upload";
import {
  filesToFileList,
  validateResumeUpload,
} from "@/lib/resume/accepted-resume-files";
import { parseResumeFile } from "@/lib/resume/parse-resume";
import { karta } from "@/lib/brand/karta";
import type {
  CandidateCoreStrengthFilter,
  CandidateExperienceFilter,
  CandidateListItem,
  CandidateSignalProfile,
  CandidateSortOption,
  CandidateSourceFilter,
  CandidateVerdictFilter,
} from "@/types/candidate";
import { sourceBadgeLabel } from "@/types/job";
import { useToast } from "@/components/ui/toast";

type UploadUiState =
  | { phase: "idle" }
  | { phase: "processing"; files: ResumeUploadFileItem[] }
  | { phase: "success"; files: ResumeUploadFileItem[]; count: number };

type PendingUpload = {
  resumeText: string;
  resumeFilename: string;
  resumeFile: File;
};

function profileTopSkills(profile: CandidateSignalProfile): string[] {
  const extended = profile as CandidateSignalProfile & { top_skills?: string[] };
  return topSkillsForDisplay(
    extended.top_skills,
    profile.skills_verified,
    profile.skills_listed_only,
  );
}

function verdictFromQueryParam(
  param: string | null,
): CandidateVerdictFilter {
  if (!param) return "all";
  const normalized = param.trim().toLowerCase();
  switch (normalized) {
    case "exceptional_match":
    case "exceptional":
      return "exceptional";
    case "strong_match":
    case "strong":
      return "strong";
    case "potential_match":
    case "potential":
      return "potential";
    case "weak_match":
    case "weak":
      return "weak";
    case "not_a_match":
      return "not_a_match";
    case "unscored":
      return "unscored";
    default:
      return "all";
  }
}

function uniqueScoredJobTitles(candidate: CandidateListItem): string[] {
  const titles = candidate.role_scores
    .map((s) => s.role_brief_title?.trim())
    .filter((t): t is string => Boolean(t));
  return [...new Set(titles)];
}

export function TalentPoolWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [verdict, setVerdict] = useState<CandidateVerdictFilter>(() =>
    verdictFromQueryParam(searchParams.get("verdict")),
  );
  const [experience, setExperience] = useState<CandidateExperienceFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<CandidateSourceFilter>("all");
  const [sort, setSort] = useState<CandidateSortOption>("recent");
  const [coreStrength, setCoreStrength] =
    useState<CandidateCoreStrengthFilter>("all");
  const [hasGithubOnly, setHasGithubOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [unscoredOpen, setUnscoredOpen] = useState(false);
  const [evaluateOpen, setEvaluateOpen] = useState(false);
  const [batchScoring, setBatchScoring] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [uploadUi, setUploadUi] = useState<UploadUiState>({ phase: "idle" });
  const { openPanel, candidateId: panelCandidateId, refreshPanel } =
    useCandidatePanel();
  const { activeBriefId } = useActiveRoleBrief();
  const [showUpload, setShowUpload] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateNotices, setDuplicateNotices] = useState<
    { fileName: string; existingId: string; existingName: string }[]
  >([]);
  const [retryingFailed, setRetryingFailed] = useState(false);
  const stuckRetryCountsRef = useRef(new Map<string, number>());
  const { toast } = useToast();

  const uploading = uploadUi.phase === "processing";

  useEffect(() => {
    setVerdict(verdictFromQueryParam(searchParams.get("verdict")));
  }, [searchParams]);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/candidates");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setCandidates(json.candidates as CandidateListItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const openFromUrl = searchParams.get("open");

  useEffect(() => {
    if (openFromUrl) openPanel(openFromUrl);
  }, [openFromUrl, openPanel]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const urlOpen = params.get("open");
    if (panelCandidateId) {
      if (urlOpen !== panelCandidateId) {
        params.set("open", panelCandidateId);
        router.replace(`/talent-pool?${params.toString()}`, { scroll: false });
      }
    } else if (urlOpen) {
      params.delete("open");
      const qs = params.toString();
      router.replace(qs ? `/talent-pool?${qs}` : "/talent-pool", { scroll: false });
    }
  }, [panelCandidateId, router, searchParams]);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  useEffect(() => {
    if (loading) return;

    const stuckCandidates = candidates.filter((c) => isStuckCandidate(c));
    if (stuckCandidates.length === 0) return;

    const batch = stuckCandidates
      .filter((c) => (stuckRetryCountsRef.current.get(c.id) ?? 0) < 3)
      .slice(0, 3);

    for (const c of batch) {
      const attempts = stuckRetryCountsRef.current.get(c.id) ?? 0;
      stuckRetryCountsRef.current.set(c.id, attempts + 1);
      toast(`Retrying stuck candidate: ${c.display_name}`, "info");
      void fetch(`/api/candidates/${c.id}/reparse`, { method: "POST" }).catch(
        console.warn,
      );
    }
  }, [candidates, loading, toast]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { id } = (e as CustomEvent<{ id: string }>).detail;
      setCandidates((prev) => prev.filter((c) => c.id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    };
    window.addEventListener("karta:candidate-deleted", handler);
    return () =>
      window.removeEventListener("karta:candidate-deleted", handler);
  }, []);

  // Fix #2: sync inline edits made inside the slide panel back to this list
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string; display_name: string; current_title: string | null; current_company: string | null }>).detail;
      if (!detail?.id) return;
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === detail.id
            ? {
                ...c,
                display_name: detail.display_name || c.display_name,
                current_title: detail.current_title ?? c.current_title,
                current_company: detail.current_company ?? c.current_company,
              }
            : c,
        ),
      );
    };
    window.addEventListener("karta:candidate-updated", handler);
    return () => window.removeEventListener("karta:candidate-updated", handler);
  }, []);

  const filtered = useMemo(() => {
    const base = filterCandidates(candidates, {
      search,
      verdict,
      companyType: "all",
      experience,
    });
    return sortCandidates(
      base
        .filter((c) => matchesSourceFilter(c, sourceFilter))
        .filter((c) => matchesCoreStrengthFilter(c, coreStrength))
        .filter((c) => !hasGithubOnly || candidateHasGithub(c)),
      sort,
    );
  }, [
    candidates,
    search,
    verdict,
    experience,
    sourceFilter,
    sort,
    coreStrength,
    hasGithubOnly,
  ]);

  const scoredFiltered = useMemo(
    () => filtered.filter((c) => c.role_scores.length > 0),
    [filtered],
  );

  const unscoredFiltered = useMemo(
    () => filtered.filter((c) => c.role_scores.length === 0),
    [filtered],
  );

  const failedCount = useMemo(
    () => candidates.filter((c) => c.parsing_status === "failed").length,
    [candidates],
  );

  const retryFailedCandidates = async () => {
    const failed = candidates.filter((c) => c.parsing_status === "failed");
    if (failed.length === 0) return;

    setRetryingFailed(true);
    setError(null);
    try {
      for (const c of failed) {
        const res = await fetch(`/api/candidates/${c.id}/reparse`, {
          method: "POST",
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(
            json.error ?? `Retry failed for ${c.display_name ?? "candidate"}`,
          );
        }
      }
      toast(
        `Retrying ${failed.length} failed candidate${failed.length === 1 ? "" : "s"}`,
        "info",
      );
      await loadCandidates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetryingFailed(false);
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const uploadOne = async (pending: PendingUpload) => {
    const res = await submitCandidateWithResume({
      ...pending,
      source: "uploaded",
    });
    const json = await res.json();
    if (res.status === 409 && json.error === "duplicate") {
      setDuplicateNotices((prev) => [
        ...prev,
        {
          fileName: pending.resumeFilename,
          existingId: String(json.existingId),
          existingName: String(json.existingName ?? "Existing candidate"),
        },
      ]);
      throw new Error("duplicate");
    }
    if (!res.ok) throw new Error(json.error ?? "Upload failed");
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const fileList = Array.from(files);
    setError(null);

    for (const file of fileList) {
      const validationError = validateResumeUpload(file);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    const initial: ResumeUploadFileItem[] = fileList.map((f) => ({
      name: f.name,
      status: "pending",
    }));
    setUploadUi({ phase: "processing", files: initial });

    let successCount = 0;
    const nextFiles = [...initial];

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        nextFiles[i] = { ...nextFiles[i], status: "processing" };
        setUploadUi({ phase: "processing", files: [...nextFiles] });

        try {
          const resumeText = await parseResumeFile(file);
          await uploadOne({
            resumeText,
            resumeFilename: file.name,
            resumeFile: file,
          });
          nextFiles[i] = { name: file.name, status: "done" };
          successCount += 1;
        } catch (err) {
          nextFiles[i] = {
            name: file.name,
            status: "error",
            error: err instanceof Error ? err.message : "Upload failed",
          };
        }
        setUploadUi({ phase: "processing", files: [...nextFiles] });
        if (i < fileList.length - 1) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      if (successCount > 0) {
        await loadCandidates();
        setUploadUi({
          phase: "success",
          files: nextFiles,
          count: successCount,
        });
        window.setTimeout(() => setUploadUi({ phase: "idle" }), 5000);
      } else {
        setError("No resumes could be processed. Check the files and try again.");
        setUploadUi({ phase: "idle" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploadUi({ phase: "idle" });
    }
  };

  const evaluateSelected = async (jobId: string) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setEvaluateOpen(false);
    setBatchScoring(true);
    setBatchProgress({ current: 0, total: ids.length });
    setError(null);
    try {
      for (let i = 0; i < ids.length; i++) {
        setBatchProgress({ current: i + 1, total: ids.length });
        const res = await fetch(`/api/candidates/${ids[i]}/score`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleBriefId: jobId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Scoring failed");
      }
      setSelected(new Set());
      await loadCandidates();
      if (panelCandidateId && ids.includes(panelCandidateId)) {
        refreshPanel();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch scoring failed");
    } finally {
      setBatchScoring(false);
      setBatchProgress(null);
    }
  };

  const selectedCount = selected.size;

  return (
    <div className={`pb-12 ${selectedCount > 0 ? "pb-24" : ""}`}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={karta.pageTitle}>Talent Pool</h1>
          <p className="mt-1 text-[15px] text-[#64748B]">
            All candidates across every job — search, filter, and open profiles.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={() => setShowUpload((s) => !s)}
            className={`inline-flex items-center gap-2 ${karta.btnPrimary}`}
          >
            <Upload className="h-4 w-4" />
            Upload Resumes
          </button>
          <ResumeUploadFileHint />
        </div>
      </div>

      {showUpload && (
        <div className={`mb-6 ${karta.card} p-4`}>
          <div className="mb-2 flex justify-between">
            <span className={karta.sectionHeading}>Upload</span>
            <button type="button" onClick={() => setShowUpload(false)}>
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
          {error && (
            <p className="mb-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <ResumeDropZone
            uploading={uploading}
            onFilesSelected={(files) => {
              void handleFiles(filesToFileList(files));
            }}
          />
        </div>
      )}

      {/* Progress is shown outside the upload panel so closing the panel mid-upload doesn't hide it */}
      {uploadUi.phase !== "idle" && (
        <div className={`mb-6 ${karta.card} p-4`}>
          <ResumeUploadProgress
            files={uploadUi.files}
            phase={uploadUi.phase}
            successCount={
              uploadUi.phase === "success" ? uploadUi.count : undefined
            }
          />
        </div>
      )}

      {batchProgress && (
        <p className="mb-4 text-sm font-medium text-[#0D9488]" role="status">
          Scoring {batchProgress.current} of {batchProgress.total}…
        </p>
      )}

      {error && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {failedCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={retryingFailed || uploading || batchScoring}
            onClick={() => void retryFailedCandidates()}
            className={`${karta.btnOutlineTeal} inline-flex items-center gap-2 px-3 py-1.5 text-sm disabled:opacity-50`}
          >
            {retryingFailed && (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            )}
            Retry {failedCount} failed candidate{failedCount === 1 ? "" : "s"}
          </button>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
            className={`w-full pl-9 ${karta.input}`}
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as CandidateSortOption)}
          className={karta.input}
          aria-label="Sort"
        >
          <option value="recent">Most recently added</option>
          <option value="oldest">Oldest first</option>
          <option value="highest_score">Highest match score</option>
          <option value="name_az">Name A to Z</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) =>
            setSourceFilter(e.target.value as CandidateSourceFilter)
          }
          className={karta.input}
          aria-label="Filter by source"
        >
          <option value="all">All sources</option>
          <option value="uploaded">Uploaded</option>
          <option value="application">Applied Directly</option>
          <option value="linkedin_profile">LinkedIn Profile</option>
        </select>
        <select
          value={verdict}
          onChange={(e) => setVerdict(e.target.value as CandidateVerdictFilter)}
          className={karta.input}
          aria-label="Filter by verdict"
        >
          {CANDIDATE_VERDICT_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={coreStrength}
          onChange={(e) =>
            setCoreStrength(e.target.value as CandidateCoreStrengthFilter)
          }
          className={karta.input}
          aria-label="Filter by core strength"
        >
          <option value="all">Any strength</option>
          <option value="backend">Backend</option>
          <option value="frontend">Frontend</option>
          <option value="data_ml">Data and ML</option>
          <option value="devops_infra">DevOps and Infra</option>
          <option value="ai_llm">AI and LLM</option>
        </select>
        <select
          value={experience}
          onChange={(e) =>
            setExperience(e.target.value as CandidateExperienceFilter)
          }
          className={karta.input}
          aria-label="Filter by experience"
        >
          <option value="all">All experience</option>
          <option value="0-3">0–3 years</option>
          <option value="4-7">4–7 years</option>
          <option value="8-12">8–12 years</option>
          <option value="13+">13+ years</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-[#334155]">
          <input
            type="checkbox"
            checked={hasGithubOnly}
            onChange={(e) => setHasGithubOnly(e.target.checked)}
          />
          Has GitHub
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : candidates.length === 0 ? (
        <div className={`${karta.card} px-6 py-12 text-center`}>
          <Users className="mx-auto h-10 w-10 text-[#0D9488]" aria-hidden />
          <h2 className="mt-6 text-[18px] font-semibold text-[#1E293B]">
            Your talent pool is empty
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#64748B]">
            Upload candidate resumes to build your pool. They stay here across all
            your roles.
          </p>
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className={`mt-6 inline-flex items-center gap-2 ${karta.btnPrimary}`}
          >
            <Upload className="h-4 w-4" />
            Upload Resumes
          </button>
          <ResumeUploadFileHint className="mt-2" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          illustration="filters"
          heading="No matches"
          subtitle="Try adjusting your search or filters to find candidates."
        />
      ) : (
        <div className="space-y-6">
          {scoredFiltered.length > 0 && (
            <div className={`${karta.card} overflow-hidden`}>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className={karta.tableHeadRow}>
                    <th className="w-10 px-3 py-3" aria-label="Select" />
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Core Strength</th>
                    <th className="px-4 py-3">Experience</th>
                    <th className="px-4 py-3">Last Evaluated Job</th>
                    <th className="px-4 py-3">Verdict</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {scoredFiltered.map((c) => {
                    const roleScore = getPrimaryRoleScore(c, activeBriefId);
                    const jobTitles = uniqueScoredJobTitles(c);
                    return (
                      <tr
                        key={c.id}
                        className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                        onClick={(e) => {
                          if (
                            (e.target as HTMLElement).closest(
                              "input,button,a",
                            )
                          ) {
                            return;
                          }
                          openPanel(c.id);
                        }}
                      >
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(c.id)}
                            onChange={() => toggleOne(c.id)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select ${c.display_name}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <CandidateIdentityCard
                            displayName={c.display_name}
                            candidateId={c.id}
                            currentTitle={c.current_title}
                            currentCompany={c.current_company}
                            yearsExperience={
                              c.signal_profile.total_years_experience
                            }
                            experienceYears={c.signal_profile.experience_years}
                            location={c.signal_profile.location}
                            topSkills={profileTopSkills(c.signal_profile)}
                            enforceMinHeight
                            education={c.signal_profile?.education ?? []}
                            careerGaps={
                              (
                                c.signal_profile as typeof c.signal_profile & {
                                  career_gaps?: Array<{ months: number }>;
                                }
                              )?.career_gaps ?? []
                            }
                          />
                        </td>
                        <td className="px-4 py-3 align-top">
                          <CoreStrengthLabel
                            primary={c.signal_profile.core_strength_primary}
                            secondary={c.signal_profile.core_strength_secondary}
                            topSkills={profileTopSkills(c.signal_profile)}
                            prefix=""
                            className="text-xs font-medium text-[#0D9488]"
                          />
                        </td>
                        <td className="px-4 py-3 align-top text-[#64748B]">
                          {c.signal_profile.total_years_experience?.trim() ||
                            "—"}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex flex-wrap gap-1">
                            {jobTitles.map((title) => (
                              <span
                                key={title}
                                className="rounded-full bg-[#0D9488]/10 px-2 py-0.5 text-[11px] font-medium text-[#0D9488]"
                              >
                                {title}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          {roleScore ? (
                            <VerdictBadge
                              verdict={roleScore.verdict}
                              score={roleScore.overall_score}
                              compact
                            />
                          ) : (
                            <span className="text-xs text-[#94A3B8]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right align-top">
                          <button
                            type="button"
                            className="text-sm font-medium text-[#0D9488] hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              openPanel(c.id);
                            }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {unscoredFiltered.length > 0 && (
            <section className={`${karta.card} overflow-hidden`}>
              <button
                type="button"
                onClick={() => setUnscoredOpen((o) => !o)}
                className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
              >
                <span className="text-base font-semibold text-slate-900">
                  Unscored Candidates ({unscoredFiltered.length})
                </span>
                {unscoredOpen ? (
                  <ChevronDown className="h-5 w-5 text-slate-500" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-slate-500" />
                )}
              </button>
              {unscoredOpen && (
                <div className="border-t border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className={karta.tableHeadRow}>
                        <th className="w-10 px-3 py-3" aria-label="Select" />
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Core Strength</th>
                        <th className="px-4 py-3">Experience</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unscoredFiltered.map((c) => (
                        <tr
                          key={c.id}
                          className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest("input,button,a")) return;
                            openPanel(c.id);
                          }}
                        >
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={selected.has(c.id)}
                              onChange={() => toggleOne(c.id)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={`Select ${c.display_name}`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <CandidateIdentityCard
                              displayName={c.display_name}
                              candidateId={c.id}
                              currentTitle={c.current_title}
                              currentCompany={c.current_company}
                              yearsExperience={
                                c.signal_profile.total_years_experience
                              }
                              experienceYears={c.signal_profile.experience_years}
                              location={c.signal_profile.location}
                              topSkills={profileTopSkills(c.signal_profile)}
                              education={c.signal_profile?.education ?? []}
                              careerGaps={
                                (
                                  c.signal_profile as typeof c.signal_profile & {
                                    career_gaps?: Array<{ months: number }>;
                                  }
                                )?.career_gaps ?? []
                              }
                            />
                          </td>
                          <td className="px-4 py-3 align-top">
                            <CoreStrengthLabel
                              primary={c.signal_profile.core_strength_primary}
                              secondary={c.signal_profile.core_strength_secondary}
                              prefix=""
                              className="text-xs font-medium text-[#0D9488]"
                            />
                          </td>
                          <td className="px-4 py-3 align-top text-[#64748B]">
                            {c.signal_profile.total_years_experience?.trim() || "—"}
                          </td>
                          <td className="px-4 py-3 text-right align-top">
                            <button
                              type="button"
                              className="text-sm font-medium text-[#0D9488] hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                openPanel(c.id);
                              }}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {selectedCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E2E8F0] bg-white px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <p className="text-sm font-medium text-[#334155]">
              {selectedCount} candidate{selectedCount === 1 ? "" : "s"} selected
            </p>
            <button
              type="button"
              disabled={batchScoring}
              onClick={() => setEvaluateOpen(true)}
              className={karta.btnPrimary}
            >
              Evaluate for Role
            </button>
          </div>
        </div>
      )}

      {evaluateOpen && (
        <ScoreRolePickerModal
          candidateName={`${selectedCount} selected candidate${selectedCount === 1 ? "" : "s"}`}
          title="Evaluate candidates against a role"
          confirmLabel="Evaluate"
          onClose={() => setEvaluateOpen(false)}
          onConfirm={(jobId) => void evaluateSelected(jobId)}
        />
      )}
    </div>
  );
}
