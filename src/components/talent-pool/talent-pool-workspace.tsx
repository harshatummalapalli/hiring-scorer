"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, Upload, X } from "lucide-react";
import { useCandidatePanel } from "@/contexts/candidate-panel-context";
import { karta } from "@/lib/brand/karta";
import {
  candidateHasGithub,
  filterCandidates,
  matchesCoreStrengthFilter,
  matchesSourceFilter,
  sortCandidates,
} from "@/lib/candidates/list-filters";
import { CandidateListMeta } from "@/components/candidates/candidate-list-meta";
import { CoreStrengthLabel } from "@/components/candidates/core-strength-label";
import { EmptyState } from "@/components/ui/empty-state";
import { formatTotalExperienceDisplay } from "@/lib/candidates/format-total-experience";
import { formatKartaDate } from "@/lib/dates/format-karta-date";
import { ScoreRolePickerModal } from "@/components/candidates/score-role-picker-modal";
import { useScoreCandidate } from "@/lib/candidates/use-score-candidate";
import { useActiveRoleBrief } from "@/contexts/active-role-brief-context";
import { VerdictBadge } from "@/components/candidates/profile-shared";
import { getScoreForRole } from "@/lib/candidates/active-role-score";
import { submitCandidateWithResume } from "@/lib/candidates/submit-candidate-upload";
import { parseResumeFile } from "@/lib/resume/parse-resume";
import type {
  CandidateCoreStrengthFilter,
  CandidateExperienceFilter,
  CandidateListItem,
  CandidateSortOption,
  CandidateSourceFilter,
  CandidateVerdictFilter,
} from "@/types/candidate";
import { sourceBadgeLabel } from "@/types/job";

export function TalentPoolWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [verdict, setVerdict] = useState<CandidateVerdictFilter>("all");
  const [experience, setExperience] = useState<CandidateExperienceFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<CandidateSourceFilter>("all");
  const [sort, setSort] = useState<CandidateSortOption>("recent");
  const [coreStrength, setCoreStrength] =
    useState<CandidateCoreStrengthFilter>("all");
  const [hasGithubOnly, setHasGithubOnly] = useState(false);
  const { openPanel, candidateId: panelCandidateId, refreshPanel } =
    useCandidatePanel();
  const { activeBriefId } = useActiveRoleBrief();
  const {
    scoring,
    pickerOpen,
    pickerCandidate,
    preselectedJobId,
    requestScoreWithDefaultJob,
    confirmPicker,
    closePicker,
  } = useScoreCandidate(() => void loadCandidates());
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const openTalentPoolPanel = (id: string) => {
    openPanel(id);
  };

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

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

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

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const resumeText = await parseResumeFile(file);
        const res = await submitCandidateWithResume({
          resumeText,
          resumeFilename: file.name,
          resumeFile: file,
          source: "uploaded",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
      }
      setShowUpload(false);
      await loadCandidates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="pb-12">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={karta.pageTitle}>Talent Pool</h1>
          <p className="mt-1 text-[15px] text-[#64748B]">
            All candidates across every job — search, filter, and open profiles.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowUpload((s) => !s)}
          className={`inline-flex items-center gap-2 ${karta.btnPrimary}`}
        >
          <Upload className="h-4 w-4" />
          Upload Resumes
        </button>
      </div>

      {showUpload && (
        <div className={`mb-6 ${karta.card} p-4`}>
          <div className="mb-2 flex justify-between">
            <span className={karta.sectionHeading}>Upload</span>
            <button type="button" onClick={() => setShowUpload(false)}>
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
          <label
            className={`flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-slate-300 py-8 text-sm text-slate-600 ${uploading ? "opacity-60" : ""}`}
          >
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              multiple
              className="sr-only"
              disabled={uploading}
              onChange={(e) => void handleFiles(e.target.files)}
            />
            Drop resumes or click to browse
          </label>
        </div>
      )}

      {error && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
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
          <option value="all">All verdicts</option>
          <option value="strong">Strong Match</option>
          <option value="possible">Potential Match</option>
          <option value="weak">Low Match</option>
          <option value="not_suitable">No Match</option>
          <option value="unscored">Not scored yet</option>
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
        <EmptyState
          illustration="network"
          heading="Your talent pool starts here"
          subtitle="Every resume you score becomes part of your permanent talent intelligence."
          action={
            <button
              type="button"
              onClick={() => setShowUpload(true)}
              className={`inline-flex items-center gap-2 ${karta.btnPrimary}`}
            >
              <Upload className="h-4 w-4" />
              Upload Resumes
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          illustration="filters"
          heading="No matches"
          subtitle="Try adjusting your search or filters to find candidates."
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((c) => {
            const jobBadges = c.role_scores
              .filter((s) => s.role_brief_title)
              .slice(0, 4);
            const years = formatTotalExperienceDisplay(
              c.signal_profile.total_years_experience,
            );
            const yearsLabel =
              years && years !== "—" ? years : null;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => openTalentPoolPanel(c.id)}
                  className={`w-full text-left ${karta.cardClickable} p-5`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[16px] font-semibold leading-[1.2] text-[#1E293B]">
                      {c.display_name}
                    </span>
                    <span
                      className={`shrink-0 rounded-full bg-slate-100 px-2 py-0.5 ${karta.badge} text-slate-700`}
                    >
                      {sourceBadgeLabel(c.source)}
                    </span>
                  </div>
                  <CoreStrengthLabel
                    primary={c.signal_profile.core_strength_primary}
                    secondary={c.signal_profile.core_strength_secondary}
                    prefix=""
                    className="mt-1.5 text-xs font-medium text-[#0D9488]"
                  />
                  <CandidateListMeta
                    currentTitle={c.current_title}
                    currentCompany={c.current_company}
                    signalProfile={c.signal_profile}
                    resumeSubtitleFallback={c.resume_subtitle_fallback}
                    showYears={false}
                  />
                  <p className="mt-2 text-[13px] text-[#94A3B8]">
                    {[
                      yearsLabel,
                      `Added ${formatKartaDate(c.applied_at ?? c.created_at)}`,
                    ]
                      .filter((line) => line && line !== "Added —")
                      .join(" · ")}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {(() => {
                      const roleScore = activeBriefId
                        ? getScoreForRole(c, activeBriefId)
                        : c.role_scores[0];
                      if (roleScore) {
                        return (
                          <VerdictBadge
                            verdict={roleScore.verdict}
                            score={roleScore.overall_score}
                            compact
                          />
                        );
                      }
                      return (
                        <button
                          type="button"
                          disabled={scoring}
                          onClick={(e) => {
                            e.stopPropagation();
                            requestScoreWithDefaultJob(
                              c.id,
                              c.display_name,
                              activeBriefId,
                            );
                          }}
                          className={`${karta.btnPrimary} px-3 py-1 text-xs`}
                        >
                          Score Now
                        </button>
                      );
                    })()}
                  </div>
                  {jobBadges.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {jobBadges.map((s) => (
                        <span
                          key={s.id}
                          className={`rounded-full bg-[#0D9488]/10 px-2 py-0.5 ${karta.badge} text-[#0D9488]`}
                        >
                          {s.role_brief_title}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {pickerOpen && pickerCandidate && (
        <ScoreRolePickerModal
          candidateName={pickerCandidate.name}
          preselectedJobId={preselectedJobId}
          onClose={closePicker}
          onConfirm={(jobId) => {
            void confirmPicker(jobId).then(() => {
              if (panelCandidateId === pickerCandidate.id) refreshPanel();
            });
          }}
        />
      )}
    </div>
  );
}
