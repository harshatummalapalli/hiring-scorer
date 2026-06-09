// Job workspace Pipeline tab — merged applicants + assessed views.

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Layers,
  LayoutList,
  Loader2,
  RotateCw,
  Upload,
  Users,
  X,
} from "lucide-react";
import { CandidateIdentityCard } from "@/components/candidates/candidate-identity-card";
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
import { isStuckCandidate } from "@/lib/candidates/stuck-processing";
import { submitCandidateWithResume } from "@/lib/candidates/submit-candidate-upload";
import { CopyButton } from "@/components/ui/copy-button";
import { EvaluatingDots } from "@/components/ui/evaluating-dots";
import { useToast } from "@/components/ui/toast";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { parseResumeFile } from "@/lib/resume/parse-resume";
import { karta } from "@/lib/brand/karta";
import {
  ResumeUploadProgress,
  type ResumeUploadFileItem,
} from "@/components/jobs/resume-upload-progress";
import type { CandidateListItem } from "@/types/candidate";
import type { Job } from "@/types/job";
import type { FitVerdict } from "@/types/score";
import { scoreToVerdict } from "@/lib/scoring/recruiter-card";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type JobPipelineTabProps = {
  jobId: string;
  jobTitle: string;
  roleBrief: Job;
};

type UploadUiState =
  | { phase: "idle" }
  | { phase: "uploading"; files: ResumeUploadFileItem[] }
  | { phase: "success"; files: ResumeUploadFileItem[]; count: number };

function candidateDisplayName(c: CandidateListItem): string {
  return c.display_name?.trim() || c.resume_filename || "Parsing...";
}

function candidateTopSkills(c: CandidateListItem): string[] {
  return c.signal_profile?.top_skills ?? [];
}

function candidateTitle(c: CandidateListItem): string {
  const displayTitle =
    c.current_title ?? c.signal_profile?.current_title ?? "";
  return displayTitle.length < 80 ? displayTitle : "";
}

function candidateCompany(c: CandidateListItem): string {
  const displayCompany =
    c.current_company ?? c.signal_profile?.current_company ?? "";
  return displayCompany.length < 80 ? displayCompany : "";
}

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

function pipelineDisplayScore(
  c: CandidateListItem,
  jobId: string,
): {
  gptScore: number | null;
  displayScore: number | null;
  verdict: FitVerdict | null;
  isPreliminary: boolean;
} {
  const roleScore = getScoreForRole(c, jobId);
  const gptScore = roleScore?.overall_score ?? null;
  const displayScore = gptScore ?? c.pre_score ?? null;
  const verdict =
    roleScore?.verdict ??
    (displayScore != null ? scoreToVerdict(displayScore) : null);
  const isPreliminary = gptScore == null && c.pre_score != null;
  return { gptScore, displayScore, verdict, isPreliminary };
}

function verdictLeftColor(
  c: CandidateListItem,
  jobId: string,
  evaluating = false,
): string {
  if (evaluating) return "#0D9488";
  const verdict = pipelineVerdictForRole(c, jobId);
  switch (verdict) {
    case "EXCEPTIONAL MATCH":
      return "#7C3AED";
    case "STRONG MATCH":
      return "#059669";
    case "POTENTIAL MATCH":
      return "#D97706";
    case "WEAK MATCH":
      return "#EA580C";
    case "NOT A MATCH":
      return "#DC2626";
    default:
      return "#E2E8F0";
  }
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
  const [focusedCandidateId, setFocusedCandidateId] = useState<string | null>(
    null,
  );
  const [isDragging, setIsDragging] = useState(false);
  const [showShortcutHint, setShowShortcutHint] = useState(true);
  const autoRetriedRef = useRef(new Set<string>());
  const { toast } = useToast();

  const { openPanel, refreshPanel, candidateId: openPanelId, closePanel } =
    useCandidatePanel();

  const isStuck = useCallback(
    (candidate: CandidateListItem) => isStuckCandidate(candidate, jobId),
    [jobId],
  );

  const panelOptions = useMemo(
    () => ({ contextJobId: jobId, roleBrief }),
    [jobId, roleBrief],
  );

  const uploading = uploadUi.phase === "uploading";

  useEffect(() => {
    const t = window.setTimeout(() => setShowShortcutHint(false), 10000);
    return () => window.clearTimeout(t);
  }, []);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
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
      if (!options?.silent) {
        setOptimisticShortlistedIds(new Set());
      }
    } catch (err) {
      if (!options?.silent) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading) return;
    const stuckCandidates = candidates.filter(isStuck);
    if (stuckCandidates.length === 0) return;

    const batch = stuckCandidates
      .filter((c) => !autoRetriedRef.current.has(c.id))
      .slice(0, 3);

    for (const c of batch) {
      autoRetriedRef.current.add(c.id);
      void fetch(`/api/candidates/${c.id}/reparse`, { method: "POST" }).catch(
        console.warn,
      );
    }
  }, [candidates, isStuck, loading]);

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

  const showEvaluatingIndicator = useMemo(
    () =>
      candidates.some(
        (c) =>
          c.scoring_status === "unscored" ||
          (c.scoring_status as string) === "evaluating",
      ) ||
      scoringId != null ||
      batchEvaluating,
    [candidates, scoringId, batchEvaluating],
  );

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel(`pipeline-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "candidates",
          filter: `job_id=eq.${jobId}`,
        },
        () => {
          void load({ silent: true });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "candidates",
          filter: `job_id=eq.${jobId}`,
        },
        () => {
          void load({ silent: true });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [jobId, load]);

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

  const verdictCounts = useMemo(
    () => ({
      exceptional: groups.exceptionalMatch.filter(
        (c) => !isExcluded(c, pipelineIds, optimisticShortlistedIds),
      ).length,
      strong: groups.strongMatch.filter(
        (c) => !isExcluded(c, pipelineIds, optimisticShortlistedIds),
      ).length,
      potential: groups.potentialMatch.filter(
        (c) => !isExcluded(c, pipelineIds, optimisticShortlistedIds),
      ).length,
      pending: groups.pendingEvaluation.filter(
        (c) => !isExcluded(c, pipelineIds, optimisticShortlistedIds),
      ).length,
      weak: groups.weakMatch.filter(
        (c) => !isExcluded(c, pipelineIds, optimisticShortlistedIds),
      ).length,
      notAMatch: groups.notAMatch.filter(
        (c) => !isExcluded(c, pipelineIds, optimisticShortlistedIds),
      ).length,
    }),
    [groups, pipelineIds, optimisticShortlistedIds],
  );

  const totalScored =
    verdictCounts.exceptional +
    verdictCounts.strong +
    verdictCounts.potential +
    verdictCounts.weak +
    verdictCounts.notAMatch;

  const totalAll = totalScored + verdictCounts.pending;

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

  useEffect(() => {
    if (flatList.length === 0) {
      setFocusedCandidateId(null);
      return;
    }
    if (
      !focusedCandidateId ||
      !flatList.some((c) => c.id === focusedCandidateId)
    ) {
      setFocusedCandidateId(flatList[0]?.id ?? null);
    }
  }, [flatList, focusedCandidateId]);

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
      toast("Candidate added to shortlist");
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
      toast("Candidate marked as not a fit");
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
    setUploadUi({ phase: "uploading", files: initial });

    let successCount = 0;
    const nextFiles = [...initial];

    try {
      const BATCH_SIZE = 10;

      for (let b = 0; b < fileList.length; b += BATCH_SIZE) {
        const batch = fileList.slice(b, b + BATCH_SIZE);
        const batchIndices = batch.map((_, j) => b + j);

        await Promise.all(
          batch.map(async (file, j) => {
            const i = batchIndices[j];
            nextFiles[i] = { ...nextFiles[i], status: "processing" };
            setUploadUi({ phase: "uploading", files: [...nextFiles] });
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
                return;
              }
              nextFiles[i] = {
                name: file.name,
                status: "error",
                error:
                  err instanceof Error ? err.message : "Upload failed",
              };
            }
            setUploadUi({ phase: "uploading", files: [...nextFiles] });
          }),
        );

        if (successCount > 0) void load();
      }

      if (successCount === 0 && !duplicateMatch) {
        const firstError = nextFiles.find((f) => f.status === "error")?.error;
        setError(
          firstError ??
            "No resumes could be uploaded. Check the files and try again.",
        );
        setUploadUi({ phase: "idle" });
        return;
      }

      if (successCount > 0) {
        void load();
        setUploadUi({
          phase: "success",
          files: nextFiles,
          count: successCount,
        });
        toast(
          `${successCount} resume${successCount > 1 ? "s" : ""} uploaded — evaluating...`,
        );
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

  const handleDroppedFiles = (files: File[]) => {
    if (files.length === 0) return;
    const dt = new DataTransfer();
    for (const file of files) {
      dt.items.add(file);
    }
    void uploadFiles(dt.files);
  };

  const focusedCandidate = useMemo(
    () => flatList.find((c) => c.id === focusedCandidateId) ?? null,
    [flatList, focusedCandidateId],
  );

  const shortcutHandlers = useMemo(
    () => ({
      "?": () => setShowShortcutHint(true),
      j: () => {
        if (flatList.length === 0) return;
        const idx = Math.max(
          0,
          flatList.findIndex((c) => c.id === focusedCandidateId),
        );
        const next = flatList[Math.min(flatList.length - 1, idx + 1)];
        if (next) setFocusedCandidateId(next.id);
      },
      k: () => {
        if (flatList.length === 0) return;
        const idx = Math.max(
          0,
          flatList.findIndex((c) => c.id === focusedCandidateId),
        );
        const prev = flatList[Math.max(0, idx - 1)];
        if (prev) setFocusedCandidateId(prev.id);
      },
      s: () => {
        if (focusedCandidate) void shortlistOne(focusedCandidate);
      },
      x: () => {
        if (focusedCandidate) setRejectTarget(focusedCandidate);
      },
      enter: () => {
        if (focusedCandidateId) {
          openPanel(focusedCandidateId, panelOptions);
        }
      },
      escape: () => closePanel(),
    }),
    [
      flatList,
      focusedCandidateId,
      focusedCandidate,
      panelOptions,
      openPanel,
      closePanel,
    ],
  );

  useKeyboardShortcuts(shortcutHandlers, flatList.length > 0);

  const retryCandidate = async (candidateId: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/reparse`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Retry failed");
      }
      await load({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    }
  };

  const renderStuckRow = (c: CandidateListItem) => (
    <div
      key={c.id}
      className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-[#1E293B]">
          {c.display_name?.trim() || c.resume_filename || "Candidate"}
        </p>
        <p className="text-xs text-amber-600">
          Processing took longer than expected
        </p>
      </div>
      <button
        type="button"
        onClick={() => void retryCandidate(c.id)}
        className="shrink-0 text-sm font-medium text-[#0D9488] hover:text-[#0B8276]"
      >
        Retry
      </button>
    </div>
  );

  const renderParsingRow = (c: CandidateListItem) => {
    if (isStuck(c)) return renderStuckRow(c);
    return (
    <div
      key={c.id}
      className="flex flex-wrap items-center gap-3 border-b border-[#F1F5F9] border-l-4 border-l-[#0D9488]/60 px-4 py-3 last:border-0 bg-[#F8FAFC]/50"
    >
      <div className="h-4 w-4 shrink-0 rounded border border-slate-200 bg-slate-100" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-4 w-32 rounded skeleton-shimmer" />
        <p className="text-xs text-slate-400">Parsing resume…</p>
      </div>
      <span className="text-xs text-[#64748B]">
        {c.resume_filename ?? "Resume"}
      </span>
    </div>
    );
  };

  const renderFailedRow = (c: CandidateListItem) => (
    <div
      key={c.id}
      className="flex flex-wrap items-center gap-3 border-b border-[#F1F5F9] border-l-4 border-l-red-300 px-4 py-3 last:border-0"
    >
      <AlertCircle className="h-4 w-4 shrink-0 text-red-500" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-red-700">
          {c.resume_filename ?? candidateDisplayName(c)}
        </p>
        <p className="text-xs text-red-500">Resume parsing failed</p>
      </div>
      <button
        type="button"
        onClick={() => void retryCandidate(c.id)}
        className={`${karta.btnOutlineTeal} inline-flex items-center gap-1.5 px-3 py-1.5 text-sm`}
      >
        <RotateCw className="h-3.5 w-3.5" />
        Retry
      </button>
    </div>
  );

  const renderEvaluatedRow = (
    c: CandidateListItem,
    showShortlist: boolean,
    showRejectionReason = false,
  ) => {
    if (isStuck(c)) return renderStuckRow(c);
    if (c.parsing_status === "pending") return renderParsingRow(c);
    if (c.parsing_status === "failed") return renderFailedRow(c);

    const { gptScore, displayScore, verdict, isPreliminary } =
      pipelineDisplayScore(c, jobId);
    const isSelected = selected.has(c.id);
    const isEvaluating = (c.scoring_status as string) === "evaluating";
    const isFocused = focusedCandidateId === c.id;
    const leftColor = verdictLeftColor(c, jobId, isEvaluating);

    return (
      <div
        key={c.id}
        role="button"
        tabIndex={0}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("button,input,label,a")) return;
          setFocusedCandidateId(c.id);
          openPanel(c.id, panelOptions);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setFocusedCandidateId(c.id);
            openPanel(c.id, panelOptions);
          }
        }}
        className={`flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/60 bg-white p-4 shadow-sm transition-all duration-200 hover:border-slate-300/60 hover:shadow-md border-l-[3px] cursor-pointer ${
          isFocused ? "ring-2 ring-teal-400/40" : ""
        } ${isEvaluating ? "pipeline-row-evaluating" : ""}`}
        style={{ borderLeftColor: leftColor }}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => toggleSelected(c.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${candidateDisplayName(c)}`}
          className="h-4 w-4 shrink-0 rounded border-slate-300"
        />
        <div className="min-w-0 flex-1">
          <CandidateIdentityCard
            displayName={candidateDisplayName(c)}
            candidateId={c.id}
            panelOptions={panelOptions}
            currentTitle={candidateTitle(c)}
            currentCompany={candidateCompany(c)}
            yearsExperience={c.signal_profile?.total_years_experience ?? ""}
            experienceYears={c.signal_profile?.experience_years}
            location={c.signal_profile?.location ?? null}
            scoredJobTitle={jobTitle}
            showMetaRow={false}
            enforceMinHeight
            education={c.signal_profile?.education ?? []}
            experience={c.signal_profile?.experience ?? []}
            careerGaps={
              (
                c.signal_profile as typeof c.signal_profile & {
                  career_gaps?: Array<{ months: number }>;
                }
              )?.career_gaps ?? []
            }
            topSkills={
              candidateTopSkills(c).length > 0
                ? candidateTopSkills(c)
                : (c.signal_profile?.skills_verified ?? []).map((s) =>
                    typeof s === "string" ? s : s.skill,
                  )
            }
            skillsVerified={c.signal_profile?.skills_verified ?? []}
            professionalSummary={c.signal_profile?.professional_summary ?? ""}
            verdict={verdict}
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
        {displayScore != null && verdict && (
          <VerdictBadge
            verdict={verdict}
            score={displayScore}
            showScore
            preliminary={isPreliminary}
            animateIn={!isPreliminary}
            scoreAnimate={gptScore != null}
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
    if (isStuck(c)) return renderStuckRow(c);
    if (c.parsing_status === "pending") return renderParsingRow(c);
    if (c.parsing_status === "failed") return renderFailedRow(c);

    const { displayScore, verdict, isPreliminary } = pipelineDisplayScore(
      c,
      jobId,
    );
    const awaitingScore =
      c.parsing_status === "complete" &&
      isPipelinePendingEvaluation(c, jobId);
    const isEvaluating =
      scoringId === c.id ||
      batchEvaluating ||
      awaitingScore;
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
          aria-label={`Select ${candidateDisplayName(c)}`}
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
            displayName={candidateDisplayName(c)}
            candidateId={c.id}
            panelOptions={panelOptions}
            currentTitle={candidateTitle(c)}
            currentCompany={candidateCompany(c)}
            yearsExperience={c.signal_profile?.total_years_experience ?? ""}
            experienceYears={c.signal_profile?.experience_years}
            location={c.signal_profile?.location ?? null}
            scoredJobTitle={jobTitle}
            showMetaRow={false}
            education={c.signal_profile?.education ?? []}
            experience={c.signal_profile?.experience ?? []}
            careerGaps={
              (
                c.signal_profile as typeof c.signal_profile & {
                  career_gaps?: Array<{ months: number }>;
                }
              )?.career_gaps ?? []
            }
            topSkills={
              candidateTopSkills(c).length > 0
                ? candidateTopSkills(c)
                : (c.signal_profile?.skills_verified ?? []).map((s) =>
                    typeof s === "string" ? s : s.skill,
                  )
            }
            skillsVerified={c.signal_profile?.skills_verified ?? []}
            professionalSummary={c.signal_profile?.professional_summary ?? ""}
            verdict={verdict}
          />
        </div>
        <div className="hidden shrink-0 text-sm text-slate-600 sm:block">
          {formatTotalExperienceDisplay(
            c.signal_profile?.total_years_experience,
          )}
        </div>
        {awaitingScore ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-sm text-[#64748B]">
            <EvaluatingDots />
            Evaluating…
          </span>
        ) : displayScore != null && verdict ? (
          <VerdictBadge
            verdict={verdict}
            score={displayScore}
            showScore
            preliminary={isPreliminary}
            animateIn={false}
          />
        ) : isEvaluating ? (
          <span className="inline-flex items-center gap-2 text-sm text-[#64748B]">
            <EvaluatingDots />
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
    if (isStuck(c)) return renderStuckRow(c);
    if (c.parsing_status === "pending") return renderParsingRow(c);
    if (c.parsing_status === "failed") return renderFailedRow(c);
    const isPending = isPipelinePendingEvaluation(c, jobId);
    if (isPending) return renderPendingRow(c);
    const verdict = pipelineVerdictForRole(c, jobId);
    const showShortlist =
      verdict === "EXCEPTIONAL MATCH" ||
      verdict === "STRONG MATCH" ||
      verdict === "POTENTIAL MATCH";
    const showRejection = verdict === "NOT A MATCH";
    return renderEvaluatedRow(c, showShortlist, showRejection);
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
            {key === "pending" && showEvaluatingIndicator && (
              <span className="inline-flex items-center gap-1.5 text-xs font-normal text-[#64748B]">
                <EvaluatingDots />
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
        {open && <div className="space-y-3 p-3">{items.map((c) => renderRow(c))}</div>}
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
      {totalAll > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {verdictCounts.exceptional > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-violet-400" />
              <span className="font-medium text-[#1E293B]">
                {verdictCounts.exceptional}
              </span>
              <span className="text-[#64748B]">Exceptional</span>
            </span>
          )}
          {verdictCounts.strong > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="font-medium text-[#1E293B]">
                {verdictCounts.strong}
              </span>
              <span className="text-[#64748B]">Strong</span>
            </span>
          )}
          {verdictCounts.potential > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="font-medium text-[#1E293B]">
                {verdictCounts.potential}
              </span>
              <span className="text-[#64748B]">Potential</span>
            </span>
          )}
          {verdictCounts.pending > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-slate-300" />
              <span className="font-medium text-[#1E293B]">
                {verdictCounts.pending}
              </span>
              <span className="text-[#64748B]">Evaluating</span>
            </span>
          )}
          {verdictCounts.weak > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-orange-300" />
              <span className="font-medium text-[#64748B]">
                {verdictCounts.weak}
              </span>
              <span className="text-[#94A3B8]">Weak</span>
            </span>
          )}
          {verdictCounts.notAMatch > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-300" />
              <span className="font-medium text-[#64748B]">
                {verdictCounts.notAMatch}
              </span>
              <span className="text-[#94A3B8]">Not a match</span>
            </span>
          )}
          <span className="ml-auto text-xs text-[#94A3B8]">
            {totalScored} of {totalAll} evaluated
          </span>
        </div>
      )}
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
          phase={uploadUi.phase === "success" ? "success" : "uploading"}
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
        <div className="flex flex-col items-center justify-center px-8 py-16">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50">
            <Users className="h-8 w-8 text-teal-400" aria-hidden />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-slate-700">
            No candidates yet
          </h3>
          <p className="mb-6 max-w-sm text-center text-sm text-slate-500">
            Upload resumes to start evaluating, or share your apply email with
            candidates.
          </p>
          <div className="flex gap-3">
            <label
              className={`inline-flex cursor-pointer items-center gap-2 ${karta.btnPrimary}`}
            >
              <Upload className="h-4 w-4" />
              Upload resumes
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
                label="Copy apply email"
                toastMessage="Apply email copied to clipboard"
                className={`${karta.btnSecondary} !text-slate-700`}
              />
            )}
          </div>
        </div>
      ) : (
        <div
          className="relative"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const files = Array.from(e.dataTransfer.files).filter(
              (f) =>
                f.type === "application/pdf" ||
                f.name.endsWith(".pdf") ||
                f.name.endsWith(".docx"),
            );
            if (files.length > 0) {
              handleDroppedFiles(files);
            }
          }}
        >
          {isDragging && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-teal-400 bg-teal-50/80 backdrop-blur-sm">
              <div className="text-center">
                <p className="text-lg font-semibold text-teal-700">
                  Drop resumes here
                </p>
                <p className="mt-1 text-sm text-teal-600">PDF or DOCX files</p>
              </div>
            </div>
          )}
          {groupedView ? (
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
        <div className="space-y-3">
          {showEvaluatingIndicator && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200/60 bg-white px-4 py-2 text-xs text-slate-500 shadow-sm">
              <EvaluatingDots />
              Evaluating candidates — scores updating automatically
            </div>
          )}
          {flatList.length === 0 ? null : flatList.map((c) => renderFlatRow(c))}
        </div>
      )}
        </div>
      )}

      {showShortcutHint && flatList.length > 0 && (
        <div className="fixed bottom-4 right-4 flex items-center gap-3 rounded-lg border border-slate-100 bg-white/80 px-3 py-2 text-[11px] text-slate-400 shadow-sm backdrop-blur-sm">
          <span>
            <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]">
              J
            </kbd>
            <span className="ml-1">Next</span>
          </span>
          <span>
            <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]">
              K
            </kbd>
            <span className="ml-1">Prev</span>
          </span>
          <span>
            <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]">
              S
            </kbd>
            <span className="ml-1">Shortlist</span>
          </span>
          <span>
            <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px]">
              X
            </kbd>
            <span className="ml-1">Pass</span>
          </span>
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
