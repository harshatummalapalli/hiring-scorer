// Job workspace Pipeline tab — merged applicants + assessed views.

"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  Layers,
  LayoutList,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { CandidateIdentityCard } from "@/components/candidates/candidate-identity-card";
import { CoreStrengthLabel } from "@/components/candidates/core-strength-label";
import { DuplicateWarningModal } from "@/components/candidates/duplicate-warning-modal";
import { NotAFitModal } from "@/components/candidates/not-a-fit-modal";
import { VerdictBadge } from "@/components/candidates/profile-shared";
import { useCandidatePanel } from "@/contexts/candidate-panel-context";
import { getScoreForRole } from "@/lib/candidates/active-role-score";
import {
  hasEvaluatedScoreForRole,
  isPipelineNotAMatch,
  isPipelinePendingEvaluation,
  pipelineVerdictForRole,
} from "@/lib/candidates/list-filters";
import type { DuplicateMatch } from "@/lib/candidates/duplicate-messages";
import { formatTotalExperienceDisplay } from "@/lib/candidates/format-total-experience";
import { submitCandidateWithResume } from "@/lib/candidates/submit-candidate-upload";
import { CopyButton } from "@/components/ui/copy-button";
import { parseResumeFile } from "@/lib/resume/parse-resume";
import { karta } from "@/lib/brand/karta";
import {
  ResumeUploadProgress,
  type ResumeUploadFileItem,
} from "@/components/jobs/resume-upload-progress";
import type { CandidateListItem } from "@/types/candidate";
import type { Job } from "@/types/job";
import type { FitVerdict } from "@/types/score";

type JobPipelineTabProps = {
  jobId: string;
  jobTitle: string;
  roleBrief: Job;
};

type UploadUiState =
  | { phase: "idle" }
  | { phase: "processing"; files: ResumeUploadFileItem[] }
  | { phase: "success"; files: ResumeUploadFileItem[]; count: number };

type PendingUpload = {
  resumeText: string;
  resumeFilename: string;
  resumeFile: File;
};

type SectionKey =
  | "exceptional"
  | "strong"
  | "potential"
  | "pending"
  | "weak"
  | "notAMatch";

const SECTION_META: Record<
  SectionKey,
  { label: string; headerClass: string; defaultOpen: boolean; showShortlist: boolean }
> = {
  exceptional: {
    label: "Exceptional Match",
    headerClass:
      "bg-violet-50 border-l-4 border-violet-400 text-violet-900 font-semibold",
    defaultOpen: true,
    showShortlist: true,
  },
  strong: {
    label: "Strong Match",
    headerClass:
      "bg-emerald-50 border-l-4 border-emerald-400 text-emerald-900 font-semibold",
    defaultOpen: true,
    showShortlist: true,
  },
  potential: {
    label: "Potential Match",
    headerClass:
      "bg-amber-50 border-l-4 border-amber-400 text-amber-900 font-semibold",
    defaultOpen: true,
    showShortlist: true,
  },
  pending: {
    label: "Pending Evaluation",
    headerClass:
      "bg-slate-50 border-l-4 border-slate-300 text-slate-700 font-semibold",
    defaultOpen: true,
    showShortlist: false,
  },
  weak: {
    label: "Weak Match",
    headerClass:
      "bg-orange-50 border-l-4 border-orange-300 text-orange-900 font-semibold",
    defaultOpen: false,
    showShortlist: false,
  },
  notAMatch: {
    label: "Not a Match",
    headerClass:
      "bg-red-50 border-l-4 border-red-200 text-red-800 font-semibold",
    defaultOpen: false,
    showShortlist: false,
  },
};

function isExcluded(
  c: CandidateListItem,
  pipelineIds: Set<string>,
  optimisticShortlistedIds: Set<string>,
): boolean {
  const id = String(c.id);
  return pipelineIds.has(id) || optimisticShortlistedIds.has(id);
}

function sortByScoreDesc(
  items: CandidateListItem[],
  jobId: string,
): CandidateListItem[] {
  return [...items].sort((a, b) => {
    const sa = getScoreForRole(a, jobId)?.overall_score ?? 0;
    const sb = getScoreForRole(b, jobId)?.overall_score ?? 0;
    return sb - sa;
  });
}

function matchesVerdict(
  c: CandidateListItem,
  jobId: string,
  verdict: FitVerdict,
): boolean {
  return pipelineVerdictForRole(c, jobId) === verdict;
}

export function JobPipelineTab({
  jobId,
  jobTitle,
  roleBrief,
}: JobPipelineTabProps) {
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [pipelineIds, setPipelineIds] = useState<Set<string>>(new Set());
  const [optimisticShortlistedIds, setOptimisticShortlistedIds] = useState<
    Set<string>
  >(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [batchEvaluating, setBatchEvaluating] = useState(false);
  const [shortlisting, setShortlisting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploadUi, setUploadUi] = useState<UploadUiState>({ phase: "idle" });
  const [rejectTarget, setRejectTarget] = useState<CandidateListItem | null>(
    null,
  );
  const [rejecting, setRejecting] = useState(false);
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateMatch | null>(
    null,
  );
  const [duplicateNotices, setDuplicateNotices] = useState<
    { fileName: string; existingId: string; existingName: string }[]
  >([]);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(
    null,
  );
  const [sectionOpen, setSectionOpen] = useState<Record<SectionKey, boolean>>(
    () =>
      Object.fromEntries(
        (Object.keys(SECTION_META) as SectionKey[]).map((k) => [
          k,
          SECTION_META[k].defaultOpen,
        ]),
      ) as Record<SectionKey, boolean>,
  );
  const [groupedView, setGroupedView] = useState(false);

  const { openPanel, refreshPanel, candidateId: openPanelId } =
    useCandidatePanel();

  const panelOptions = useMemo(
    () => ({ contextJobId: jobId, roleBrief }),
    [jobId, roleBrief],
  );

  const uploading = uploadUi.phase === "processing";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetch(`/api/jobs/${jobId}/reclassify-applicants`, { method: "POST" });
      const [candRes, pipeRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}/candidates`),
        fetch(`/api/pipeline?role_brief_id=${encodeURIComponent(jobId)}`),
      ]);
      const candJson = await candRes.json();
      if (!candRes.ok) throw new Error(candJson.error ?? "Failed to load");
      setCandidates(candJson.candidates as CandidateListItem[]);
      if (pipeRes.ok) {
        const pipeJson = await pipeRes.json();
        const ids = new Set<string>();
        for (const section of pipeJson.sections ?? []) {
          for (const row of section.candidates ?? []) {
            ids.add(String(row.candidate_id));
          }
        }
        setPipelineIds(ids);
      }
      setOptimisticShortlistedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

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

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ jobId?: string }>).detail;
      if (detail?.jobId && detail.jobId !== jobId) return;
      void load();
    };
    window.addEventListener("karta:job-scores-recomputed", handler);
    return () =>
      window.removeEventListener("karta:job-scores-recomputed", handler);
  }, [jobId, load]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (
        e as CustomEvent<{
          id: string;
          display_name: string;
          current_title: string | null;
          current_company: string | null;
        }>
      ).detail;
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

  const [pollingActive, setPollingActive] = useState(false);

  useEffect(() => {
    const hasPending = candidates.some(
      (c) =>
        c.scoring_status === "unscored" ||
        c.scoring_status === "needs_scoring",
    );
    setPollingActive(hasPending);
  }, [candidates]);

  useEffect(() => {
    if (!pollingActive) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/candidates`);
        if (!res.ok) return;
        const json = await res.json();
        const updated = json.candidates as CandidateListItem[];
        setCandidates(updated);
        const stillPending = updated.some(
          (c) =>
            c.scoring_status === "unscored" ||
            c.scoring_status === "needs_scoring",
        );
        if (!stillPending) setPollingActive(false);
      } catch {
        // best-effort polling
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [pollingActive, jobId]);

  const groups = useMemo(() => {
    const ex = (c: CandidateListItem) =>
      isExcluded(c, pipelineIds, optimisticShortlistedIds);

    const exceptionalMatch = sortByScoreDesc(
      candidates.filter(
        (c) =>
          !ex(c) &&
          matchesVerdict(c, jobId, "EXCEPTIONAL MATCH"),
      ),
      jobId,
    );
    const strongMatch = sortByScoreDesc(
      candidates.filter(
        (c) => !ex(c) && matchesVerdict(c, jobId, "STRONG MATCH"),
      ),
      jobId,
    );
    const potentialMatch = sortByScoreDesc(
      candidates.filter(
        (c) => !ex(c) && matchesVerdict(c, jobId, "POTENTIAL MATCH"),
      ),
      jobId,
    );
    const pendingEvaluation = candidates
      .filter((c) => !ex(c) && isPipelinePendingEvaluation(c, jobId))
      .sort(
        (a, b) =>
          new Date(b.applied_at ?? b.created_at).getTime() -
          new Date(a.applied_at ?? a.created_at).getTime(),
      );
    const weakMatch = sortByScoreDesc(
      candidates.filter(
        (c) => !ex(c) && matchesVerdict(c, jobId, "WEAK MATCH"),
      ),
      jobId,
    );
    const notAMatch = sortByScoreDesc(
      candidates.filter((c) => !ex(c) && isPipelineNotAMatch(c, jobId)),
      jobId,
    );

    const assigned = new Set<string>();
    for (const list of [
      exceptionalMatch,
      strongMatch,
      potentialMatch,
      pendingEvaluation,
      weakMatch,
      notAMatch,
    ]) {
      for (const c of list) assigned.add(c.id);
    }
    const ungrouped = candidates.filter((c) => !ex(c) && !assigned.has(c.id));
    const pendingWithUngrouped = [...pendingEvaluation, ...ungrouped].sort(
      (a, b) =>
        new Date(b.applied_at ?? b.created_at).getTime() -
        new Date(a.applied_at ?? a.created_at).getTime(),
    );

    return {
      exceptionalMatch,
      strongMatch,
      potentialMatch,
      pendingEvaluation: pendingWithUngrouped,
      weakMatch,
      notAMatch,
    };
  }, [candidates, jobId, pipelineIds, optimisticShortlistedIds]);

  const flatList = useMemo(() => {
    const ex = (c: CandidateListItem) =>
      isExcluded(c, pipelineIds, optimisticShortlistedIds);

    const scored = [
      ...groups.exceptionalMatch,
      ...groups.strongMatch,
      ...groups.potentialMatch,
      ...groups.weakMatch,
      ...groups.notAMatch,
    ].filter((c) => !ex(c));

    const pending = groups.pendingEvaluation.filter((c) => !ex(c));

    return [...scored, ...pending];
  }, [groups, pipelineIds, optimisticShortlistedIds]);

  const visibleApplicants = useMemo(
    () =>
      candidates.filter(
        (c) => !isExcluded(c, pipelineIds, optimisticShortlistedIds),
      ),
    [candidates, pipelineIds, optimisticShortlistedIds],
  );

  const hasAnyCandidate = visibleApplicants.length > 0;
  const allOnShortlist =
    candidates.length > 0 && visibleApplicants.length === 0;

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const evaluateOne = async (candidateId: string) => {
    setScoringId(candidateId);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleBriefId: jobId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Evaluation failed");
      await load();
      if (openPanelId === candidateId) refreshPanel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Evaluation failed");
    } finally {
      setScoringId(null);
    }
  };

  const evaluateSelected = async () => {
    const ids = [...selected].filter((id) => {
      const c = candidates.find((x) => x.id === id);
      return c && isPipelinePendingEvaluation(c, jobId);
    });
    if (ids.length === 0) return;
    setBatchEvaluating(true);
    setError(null);
    const failures: { id: string; message: string }[] = [];
    let succeeded = 0;

    try {
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        setScoringId(id);
        try {
          const res = await fetch(`/api/candidates/${id}/score`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roleBriefId: jobId }),
          });
          const json = await res.json();
          if (!res.ok) {
            failures.push({ id, message: json.error ?? "Evaluation failed" });
            continue;
          }
          succeeded += 1;
        } catch (err) {
          failures.push({
            id,
            message: err instanceof Error ? err.message : "Evaluation failed",
          });
        }
        if (i < ids.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
      setSelected(new Set());
      await load();
      if (openPanelId && ids.includes(openPanelId)) refreshPanel();
      if (failures.length > 0) {
        const detail = failures
          .slice(0, 3)
          .map((f) => {
            const n =
              candidates.find((c) => c.id === f.id)?.display_name ??
              "Candidate";
            return `${n}: ${f.message}`;
          })
          .join(" · ");
        setError(
          succeeded > 0
            ? `Evaluated ${succeeded} of ${ids.length}. Failed: ${detail}${failures.length > 3 ? "…" : ""}`
            : `Evaluation failed: ${detail}`,
        );
      }
    } finally {
      setScoringId(null);
      setBatchEvaluating(false);
    }
  };

  const shortlistOne = async (target: CandidateListItem) => {
    const targetId = String(target.id);
    setOptimisticShortlistedIds((prev) => new Set(prev).add(targetId));
    setShortlisting(true);
    setError(null);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_brief_id: jobId,
          candidate_ids: [targetId],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Shortlist failed");
      setPipelineIds((prev) => new Set(prev).add(targetId));
    } catch (err) {
      setOptimisticShortlistedIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
      setError(
        err instanceof Error ? err.message : "Shortlist failed",
      );
    } finally {
      setShortlisting(false);
    }
  };

  const shortlistSelected = async () => {
    const ids = [...selected].filter((id) => {
      const c = candidates.find((x) => x.id === id);
      if (!c || !hasEvaluatedScoreForRole(c, jobId)) return false;
      const v = getScoreForRole(c, jobId)?.verdict;
      return (
        v === "EXCEPTIONAL MATCH" ||
        v === "STRONG MATCH" ||
        v === "POTENTIAL MATCH"
      );
    });
    if (ids.length === 0) return;
    setShortlisting(true);
    setError(null);
    setOptimisticShortlistedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_brief_id: jobId,
          candidate_ids: ids,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Shortlist failed");
      setPipelineIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return next;
      });
      setSelected(new Set());
    } catch (err) {
      setOptimisticShortlistedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      setError(err instanceof Error ? err.message : "Shortlist failed");
    } finally {
      setShortlisting(false);
    }
  };

  const confirmReject = async (reason: string, detail: string | null) => {
    if (!rejectTarget) return;
    setRejecting(true);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${rejectTarget.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleBriefId: jobId,
          reason,
          reasonDetail: detail,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to mark not a fit");
      setRejectTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark not a fit");
    } finally {
      setRejecting(false);
    }
  };

  const uploadOne = async (pending: PendingUpload, force = false) => {
    const res = await submitCandidateWithResume({
      ...pending,
      jobId,
      source: "uploaded",
      forceUpload: force,
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
    if (res.status === 409 && json.duplicate) {
      setDuplicateMatch(json.duplicate as DuplicateMatch);
      setPendingUpload(pending);
      throw new Error("duplicate");
    }
    if (!res.ok) {
      if (json.id) return;
      const detail =
        typeof json.detail === "string" ? json.detail : undefined;
      const msg = String(json.error ?? "Upload failed");
      throw new Error(detail ? `${msg} (${detail})` : msg);
    }
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const fileList = Array.from(files);
    setError(null);
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
          if (err instanceof Error && err.message === "duplicate") {
            nextFiles[i] = {
              name: file.name,
              status: "error",
              error: "Duplicate — resolve prompt",
            };
            break;
          }
          nextFiles[i] = {
            name: file.name,
            status: "error",
            error: err instanceof Error ? err.message : "Upload failed",
          };
        }
        setUploadUi({ phase: "processing", files: [...nextFiles] });
      }

      if (successCount > 0) await load();

      if (successCount === 0 && !duplicateMatch) {
        const firstError = nextFiles.find((f) => f.status === "error")?.error;
        setError(
          firstError ??
            "No resumes could be processed. Check the files and try again.",
        );
        setUploadUi({ phase: "idle" });
        return;
      }

      if (successCount > 0) {
        setUploadUi({
          phase: "success",
          files: nextFiles,
          count: successCount,
        });
        window.setTimeout(() => setUploadUi({ phase: "idle" }), 5000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploadUi({ phase: "idle" });
    }
  };

  const handleDuplicateProceed = async () => {
    if (!pendingUpload) return;
    const pending = pendingUpload;
    setDuplicateMatch(null);
    setPendingUpload(null);
    try {
      await uploadOne(pending, true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const topRejectionReason = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of groups.notAMatch) {
      const reason = c.manual_rejection_reason?.trim();
      if (!reason) continue;
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [reason, count] of counts) {
      if (count > bestCount) {
        bestCount = count;
        best = reason;
      }
    }
    return best;
  }, [groups.notAMatch]);

  function verdictBorderClass(c: CandidateListItem): string {
    const verdict = pipelineVerdictForRole(c, jobId);
    switch (verdict) {
      case "EXCEPTIONAL MATCH":
        return "border-l-4 border-l-violet-400";
      case "STRONG MATCH":
        return "border-l-4 border-l-emerald-400";
      case "POTENTIAL MATCH":
        return "border-l-4 border-l-amber-400";
      case "WEAK MATCH":
        return "border-l-4 border-l-orange-300";
      case "NOT A MATCH":
        return "border-l-4 border-l-red-300";
      default:
        return "border-l-4 border-l-slate-200";
    }
  }

  const renderEvaluatedRow = (
    c: CandidateListItem,
    showShortlist: boolean,
    showRejectionReason = false,
    flatMode = false,
  ) => {
    const score = getScoreForRole(c, jobId);
    const isSelected = selected.has(c.id);

    return (
      <div
        key={c.id}
        role="button"
        tabIndex={0}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button,input,label,a")) return;
          openPanel(c.id, panelOptions);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPanel(c.id, panelOptions);
          }
        }}
        className={`flex flex-wrap items-center gap-3 border-b border-[#F1F5F9] px-4 py-3 last:border-0 hover:bg-slate-50/80 cursor-pointer ${flatMode ? verdictBorderClass(c) : ""}`}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleSelected(c.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${c.display_name}`}
          className="h-4 w-4 shrink-0 rounded border-slate-300"
        />
        <div className="min-w-0 flex-1">
          <CandidateIdentityCard
            displayName={c.display_name}
            candidateId={c.id}
            panelOptions={panelOptions}
            currentTitle={c.current_title}
            currentCompany={c.current_company}
            yearsExperience={c.signal_profile.total_years_experience}
            experienceYears={c.signal_profile.experience_years}
            location={c.signal_profile.location}
            scoredJobTitle={jobTitle}
            showMetaRow={false}
            enforceMinHeight
            education={c.signal_profile?.education ?? []}
            careerGaps={
              (
                c.signal_profile as typeof c.signal_profile & {
                  career_gaps?: Array<{ months: number }>;
                }
              )?.career_gaps ?? []
            }
            topSkills={
              (
                c.signal_profile as typeof c.signal_profile & {
                  top_skills?: string[];
                }
              )?.top_skills ??
              (c.signal_profile.skills_verified ?? []).map((s) =>
                typeof s === "string" ? s : s.skill,
              )
            }
          />
          <CoreStrengthLabel
            primary={c.signal_profile.core_strength_primary}
            secondary={c.signal_profile.core_strength_secondary}
            topSkills={
              (
                c.signal_profile as typeof c.signal_profile & {
                  top_skills?: string[];
                }
              ).top_skills
            }
          />
          {showRejectionReason && c.manual_rejection_reason && (
            <span className="mt-0.5 inline-block rounded bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
              {c.manual_rejection_reason}
              {c.manual_rejection_detail
                ? ` — ${c.manual_rejection_detail}`
                : ""}
            </span>
          )}
        </div>
        <div className="hidden shrink-0 text-sm text-slate-600 sm:block">
          {formatTotalExperienceDisplay(
            c.signal_profile.total_years_experience,
          )}
        </div>
        {score && (
          <VerdictBadge
            verdict={score.verdict}
            score={score.overall_score}
            showScore
          />
        )}
        <div
          className="flex shrink-0 items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {showShortlist && (
            <button
              type="button"
              disabled={shortlisting}
              onClick={() => void shortlistOne(c)}
              className="text-sm font-semibold text-[#0D9488] hover:underline disabled:opacity-50"
            >
              → Shortlist
            </button>
          )}
          <button
            type="button"
            disabled={rejecting || batchEvaluating}
            onClick={() => setRejectTarget(c)}
            className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <X className="h-3 w-3" aria-hidden />
            Not a Fit
          </button>
        </div>
      </div>
    );
  };

  const renderPendingRow = (c: CandidateListItem) => {
    const isEvaluating = scoringId === c.id;
    const isSelected = selected.has(c.id);

    return (
      <div
        key={c.id}
        className="flex flex-wrap items-center gap-3 border-b border-[#F1F5F9] px-4 py-3 last:border-0 hover:bg-slate-50/80"
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleSelected(c.id)}
          aria-label={`Select ${c.display_name}`}
          className="h-4 w-4 shrink-0 rounded border-slate-300"
        />
        <div
          className="min-w-0 flex-1 cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => openPanel(c.id, panelOptions)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openPanel(c.id, panelOptions);
            }
          }}
        >
          <CandidateIdentityCard
            displayName={c.display_name}
            candidateId={c.id}
            panelOptions={panelOptions}
            currentTitle={c.current_title}
            currentCompany={c.current_company}
            yearsExperience={c.signal_profile.total_years_experience}
            experienceYears={c.signal_profile.experience_years}
            location={c.signal_profile.location}
            scoredJobTitle={jobTitle}
            showMetaRow={false}
            education={c.signal_profile?.education ?? []}
            careerGaps={
              (
                c.signal_profile as typeof c.signal_profile & {
                  career_gaps?: Array<{ months: number }>;
                }
              )?.career_gaps ?? []
            }
            topSkills={
              (
                c.signal_profile as typeof c.signal_profile & {
                  top_skills?: string[];
                }
              )?.top_skills ??
              (c.signal_profile.skills_verified ?? []).map((s) =>
                typeof s === "string" ? s : s.skill,
              )
            }
          />
          <CoreStrengthLabel
            primary={c.signal_profile.core_strength_primary}
            secondary={c.signal_profile.core_strength_secondary}
          />
        </div>
        <div className="hidden shrink-0 text-sm text-slate-600 sm:block">
          {formatTotalExperienceDisplay(
            c.signal_profile.total_years_experience,
          )}
        </div>
        {isEvaluating ? (
          <span className="inline-flex items-center gap-2 text-sm text-[#64748B]">
            <Loader2 className="h-4 w-4 animate-spin text-[#0D9488]" />
            Evaluating…
          </span>
        ) : (
          <button
            type="button"
            disabled={batchEvaluating}
            onClick={() => void evaluateOne(c.id)}
            className={`${karta.btnOutlineTeal} px-3 py-1.5 text-sm`}
          >
            Evaluate
          </button>
        )}
      </div>
    );
  };

  const renderFlatRow = (c: CandidateListItem) => {
    const isPending = isPipelinePendingEvaluation(c, jobId);
    if (isPending) return renderPendingRow(c);
    const verdict = pipelineVerdictForRole(c, jobId);
    const showShortlist =
      verdict === "EXCEPTIONAL MATCH" ||
      verdict === "STRONG MATCH" ||
      verdict === "POTENTIAL MATCH";
    const showRejection = verdict === "NOT A MATCH";
    return renderEvaluatedRow(c, showShortlist, showRejection, true);
  };

  const renderSection = (
    key: SectionKey,
    items: CandidateListItem[],
    renderRow: (c: CandidateListItem) => ReactNode,
  ) => {
    if (items.length === 0) return null;
    const meta = SECTION_META[key];
    const open = sectionOpen[key];

    return (
      <section key={key} className={`${karta.card} overflow-hidden`}>
        <button
          type="button"
          onClick={() =>
            setSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }))
          }
          className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${meta.headerClass}`}
        >
          <span className="inline-flex flex-wrap items-center gap-2">
            {meta.label} · {items.length}
            {key === "pending" && pollingActive && (
              <span className="inline-flex items-center gap-1 text-xs font-normal text-[#64748B]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />
                Evaluating…
              </span>
            )}
          </span>
          {open ? (
            <ChevronDown className="h-5 w-5 shrink-0 opacity-70" />
          ) : (
            <ChevronRight className="h-5 w-5 shrink-0 opacity-70" />
          )}
        </button>
        {open && key === "notAMatch" && topRejectionReason && (
          <p className="border-b border-[#F1F5F9] px-4 pb-2 text-xs text-[#94A3B8]">
            Most common: {topRejectionReason}
          </p>
        )}
        {open && <div>{items.map((c) => renderRow(c))}</div>}
      </section>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex items-center rounded-lg border border-slate-200 p-0.5">
          <button
            type="button"
            onClick={() => setGroupedView(false)}
            title="Flat list — ranked by score"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              !groupedView
                ? "bg-[#1E293B] text-white"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <LayoutList className="h-4 w-4" />
            Ranked
          </button>
          <button
            type="button"
            onClick={() => setGroupedView(true)}
            title="Grouped by verdict band"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              groupedView
                ? "bg-[#1E293B] text-white"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Layers className="h-4 w-4" />
            Grouped
          </button>
        </div>
        <label
          className={`inline-flex cursor-pointer items-center gap-2 ${karta.btnPrimary} ${
            uploading ? "pointer-events-none opacity-70" : ""
          }`}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Add Applicants
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              void uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {uploadUi.phase !== "idle" && (
        <ResumeUploadProgress
          files={uploadUi.files}
          phase={uploadUi.phase}
          successCount={
            uploadUi.phase === "success" ? uploadUi.count : undefined
          }
        />
      )}

      {duplicateNotices.length > 0 && (
        <ul className="space-y-2">
          {duplicateNotices.map((n) => (
            <li
              key={`${n.fileName}-${n.existingId}`}
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm"
            >
              <p className="font-medium text-amber-900">
                Already in your workspace
              </p>
              <p className="mt-1 text-amber-800">
                {n.fileName}: This resume matches {n.existingName}.
              </p>
              <button
                type="button"
                className="mt-2 font-medium text-[#0D9488] hover:underline"
                onClick={() => {
                  openPanel(n.existingId, panelOptions);
                  setDuplicateNotices((prev) =>
                    prev.filter((x) => x.existingId !== n.existingId),
                  );
                }}
              >
                View existing profile
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {allOnShortlist ? (
        <div className={`${karta.card} px-6 py-12 text-center`}>
          <h2 className="text-[18px] font-semibold text-[#1E293B]">
            All applicants are on your shortlist
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#64748B]">
            {candidates.length} applicant
            {candidates.length === 1 ? "" : "s"} for this role — open the
            Shortlist tab to review them.
          </p>
        </div>
      ) : !hasAnyCandidate ? (
        <div className={`${karta.card} px-6 py-12 text-center`}>
          <Upload
            className="mx-auto h-10 w-10 text-slate-300"
            aria-hidden
          />
          <h2 className="mt-6 text-[18px] font-semibold text-[#1E293B]">
            No candidates yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#64748B]">
            Upload resumes or share your apply link to start building your
            pipeline.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <label
              className={`inline-flex cursor-pointer items-center gap-2 ${karta.btnOutlineTeal}`}
            >
              <Upload className="h-4 w-4" />
              Upload Resumes
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                multiple
                className="sr-only"
                onChange={(e) => {
                  void uploadFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {(roleBrief.inbound_email ?? roleBrief.apply_link) && (
              <CopyButton
                text={roleBrief.inbound_email ?? roleBrief.apply_link ?? ""}
                label="Copy Apply Link"
                className="text-sm"
              />
            )}
          </div>
        </div>
      ) : groupedView ? (
        <div className="space-y-4">
          {renderSection("exceptional", groups.exceptionalMatch, (c) =>
            renderEvaluatedRow(c, true),
          )}
          {renderSection("strong", groups.strongMatch, (c) =>
            renderEvaluatedRow(c, true),
          )}
          {renderSection("potential", groups.potentialMatch, (c) =>
            renderEvaluatedRow(c, true),
          )}
          {renderSection("pending", groups.pendingEvaluation, renderPendingRow)}
          {renderSection("weak", groups.weakMatch, (c) =>
            renderEvaluatedRow(c, false),
          )}
          {renderSection("notAMatch", groups.notAMatch, (c) =>
            renderEvaluatedRow(c, false, true),
          )}
        </div>
      ) : (
        <div className={`${karta.card} overflow-hidden`}>
          {pollingActive && (
            <div className="flex items-center gap-2 border-b border-[#F1F5F9] px-4 py-2 text-xs text-[#64748B]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />
              Evaluating candidates — scores updating automatically
            </div>
          )}
          {flatList.length === 0 ? null : flatList.map((c) => renderFlatRow(c))}
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E2E8F0] bg-white px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
            <span className="text-sm text-[#64748B]">
              <span className="font-semibold text-[#1E293B]">
                {selected.size}
              </span>{" "}
              candidates selected
            </span>
            <button
              type="button"
              disabled={batchEvaluating || shortlisting}
              onClick={() => void evaluateSelected()}
              className={karta.btnPrimary}
            >
              Evaluate Selected
            </button>
            <button
              type="button"
              disabled={batchEvaluating || shortlisting}
              onClick={() => void shortlistSelected()}
              className={karta.btnOutlineTeal}
            >
              Shortlist Selected
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-sm font-semibold text-[#64748B] hover:text-[#1E293B]"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {rejectTarget && (
        <NotAFitModal
          candidateName={rejectTarget.display_name}
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason, detail) => void confirmReject(reason, detail)}
        />
      )}

      {duplicateMatch && (
        <DuplicateWarningModal
          match={duplicateMatch}
          onViewExisting={() => {
            openPanel(duplicateMatch.candidateId, panelOptions);
            setDuplicateMatch(null);
            setPendingUpload(null);
          }}
          onProceed={() => void handleDuplicateProceed()}
        />
      )}
    </div>
  );
}
