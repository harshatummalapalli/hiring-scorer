"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, ClipboardList, Loader2, RotateCw, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { CandidateDetail, CandidateSignalProfile } from "@/types/candidate";
import type { RoleBrief } from "@/types/role-brief";
import type { FitVerdict } from "@/types/score";
import { computeBriefContentHash } from "@/lib/role-brief/jd-cache";
import { scoreToVerdict } from "@/lib/scoring/recruiter-card";
import {
  pickDefaultScoreId,
  scoresWithSnapshots,
} from "@/lib/candidates/pick-panel-score";
import { extractContradictions } from "@/lib/candidates/score-snapshot-utils";
import { useActiveRoleBrief } from "@/contexts/active-role-brief-context";
import { karta } from "@/lib/brand/karta";
import { snapshotToRoleBrief } from "@/lib/saved-scores/build-save-payload";
import { downloadKartaAssessmentPdf } from "@/lib/reports/karta-assessment-pdf";
import type { RoleBriefSnapshot } from "@/types/saved-score";
import { CandidatePanelHeader } from "./candidate-panel-header";
import {
  CandidatePanelTabs,
  type CandidatePanelTabId,
} from "./candidate-panel-tabs";
import { CandidatePanelProfileTab } from "./candidate-panel-profile-tab";
import { ScoreRolePickerModal } from "./score-role-picker-modal";
import { useScoreCandidate } from "@/lib/candidates/use-score-candidate";
import { NotAFitModal } from "./not-a-fit-modal";
import { VerdictBadge } from "./profile-shared";
import { DimensionDonut } from "@/components/candidates/dimension-donut";
import { ScoreBreakdownSection } from "@/components/candidates/score-breakdown-section";
import { SkillsMatchSection } from "@/components/candidates/skills-match-section";
import { ConfidenceIndicator } from "@/components/candidates/confidence-indicator";
import { RecommendedActionSection } from "@/components/candidates/recommended-action-section";
import { WhyThisCandidateSection } from "@/components/candidates/why-this-candidate-section";
import { InterviewBriefSection } from "@/components/candidates/interview-brief-section";
import { CandidateResumeSection } from "@/components/candidates/candidate-resume-section";
import { ParseFailureHelp } from "@/components/candidates/parse-failure-help";
import type { InterviewBrief } from "@/types/score";
import { useToast } from "@/components/ui/toast";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function resolvePanelProfile(candidate: CandidateDetail): CandidateSignalProfile {
  const raw = candidate.signal_profile;
  if (raw && typeof raw === "object") {
    return {
      ...raw,
      display_name: raw.display_name?.trim() || candidate.display_name || "Candidate",
      skills_verified: raw.skills_verified ?? [],
      skills_listed_only: raw.skills_listed_only ?? [],
      experience: raw.experience ?? [],
      education: raw.education ?? [],
      positive_signals: raw.positive_signals ?? [],
      watch_signals: raw.watch_signals ?? [],
      portfolio_links: raw.portfolio_links ?? [],
      career_types_sequence: raw.career_types_sequence ?? [],
      core_strength_breakdown: raw.core_strength_breakdown ?? {},
    };
  }
  return {
    display_name: candidate.display_name || "Candidate",
    first_name: "",
    last_name: "",
    current_title: candidate.current_title,
    most_recent_title: candidate.current_title ?? "",
    current_company: candidate.current_company,
    location: null,
    total_years_experience: "",
    linkedin_url: null,
    portfolio_links: [],
    career_pattern: "",
    career_types_sequence: [],
    shows_product_progression: false,
    professional_summary: "",
    resume_quality: {
      ownership: {
        ratio_percent: 0,
        ownership_examples: [],
        participation_examples: [],
        ownership_count: 0,
        participation_count: 0,
        neutral_count: 0,
        total_bullets: 0,
      },
      quantification: {
        ratio_percent: 0,
        level: "rarely",
        quantified_examples: [],
        quantified_count: 0,
        total_bullets: 0,
      },
      keyword_stuffing: {
        flagged: false,
        explanation: "",
        skills_listed: 0,
        skills_in_work_context: 0,
        skills_in_work_percent: 0,
        work_bullet_quantified_percent: 0,
      },
    },
    ownership_ratio_percent: 0,
    quantification_ratio_percent: 0,
    quantification_level: "rarely",
    keyword_stuffing_flagged: false,
    keyword_stuffing_explanation: "",
    trajectory_velocity: "normal",
    positive_signals: [],
    watch_signals: [],
    experience: [],
    experience_fallback_raw: null,
    education: [],
    skills_verified: [],
    skills_listed_only: [],
    title_band: null,
    core_strength_primary: null,
    core_strength_secondary: null,
    core_strength_breakdown: {},
  };
}

function parsingStatusLabel(candidate: CandidateDetail): string | null {
  const parsing = candidate.parsing_status as string;
  if (parsing === "failed") return "Parsing failed";
  if (parsing === "pending" || parsing === "parsing") return "Parsing resume…";
  if ((candidate.scoring_status as string) === "evaluating") {
    return "Evaluating…";
  }
  return null;
}

function ScoreHistorySection({
  fits,
}: {
  fits: CandidateDetail["role_fit_scores"];
}) {
  const [open, setOpen] = useState(false);
  if (fits.length === 0) return null;

  return (
    <section className={`${karta.card} p-4`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <h3 className={karta.sectionHeading}>Score History</h3>
        <span className="text-xs font-medium text-[#0D9488]">
          {open ? "Hide" : `Show ${fits.length}`}
        </span>
      </button>
      {open && (
        <ul className="mt-3 divide-y divide-[#F1F5F9]">
          {fits.map((fit) => (
            <li
              key={fit.id}
              className="flex items-center justify-between gap-2 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-[#1E293B]">
                  {fit.role_brief_title ?? "Job role"}
                </p>
                <p className="text-xs text-[#64748B]">
                  {formatDate(fit.created_at)}
                </p>
              </div>
              <VerdictBadge
                verdict={fit.verdict as FitVerdict}
                score={fit.overall_score}
                showScore
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type CandidateSlidePanelProps = {
  candidateId: string | null;
  contextJobId?: string | null;
  roleBrief?: RoleBrief | null;
  onClose: () => void;
  onScored?: () => void;
};

export function CandidateSlidePanel({
  candidateId,
  contextJobId = null,
  roleBrief = null,
  onClose,
  onScored,
}: CandidateSlidePanelProps) {
  const { activeBriefId } = useActiveRoleBrief();
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [cvDownloadBusy, setCvDownloadBusy] = useState(false);
  const [selectedFitId, setSelectedFitId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CandidatePanelTabId>("overview");
  const [panelExiting, setPanelExiting] = useState(false);
  const [inShortlist, setInShortlist] = useState(false);
  const [shortlistBusy, setShortlistBusy] = useState(false);
  const [passModalOpen, setPassModalOpen] = useState(false);
  const [passBusy, setPassBusy] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [moveRoleBusy, setMoveRoleBusy] = useState(false);
  const [reEvaluateBusy, setReEvaluateBusy] = useState(false);
  const [retryParseBusy, setRetryParseBusy] = useState(false);
  const [noteFilter, setNoteFilter] = useState<"all" | "role">(
    contextJobId ? "role" : "all",
  );

  const { toast } = useToast();

  const handlePanelClose = () => {
    setPanelExiting(true);
    window.setTimeout(() => {
      setPanelExiting(false);
      onClose();
    }, 200);
  };

  useEffect(() => {
    if (candidateId) {
      setPanelExiting(false);
      setActiveTab("overview");
      setDeleteConfirm(false);
      setPassModalOpen(false);
    }
  }, [candidateId]);

  useEffect(() => {
    void createSupabaseBrowserClient()
      .auth.getUser()
      .then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const load = useCallback(async () => {
    if (!candidateId) {
      setCandidate(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setCandidate(json.candidate as CandidateDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setCandidate(null);
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  useEffect(() => {
    void load();
  }, [load, candidateId]);

  useEffect(() => {
    if (!candidate) {
      setSelectedFitId(null);
      return;
    }
    setSelectedFitId(
      pickDefaultScoreId(candidate.role_fit_scores, contextJobId),
    );
  }, [candidateId, candidate, contextJobId]);

  const historicalFits = useMemo(
    () => scoresWithSnapshots(candidate?.role_fit_scores ?? []),
    [candidate],
  );

  const selectedFit = useMemo(() => {
    if (!candidate || !selectedFitId) return null;
    return (
      candidate.role_fit_scores.find((f) => f.id === selectedFitId) ?? null
    );
  }, [candidate, selectedFitId]);

  const panelCandidate = useMemo(() => {
    if (!candidate) return null;
    return {
      ...candidate,
      signal_profile: resolvePanelProfile(candidate),
    };
  }, [candidate]);

  const displayResult = selectedFit?.score_snapshot ?? null;
  const hasScore = Boolean(displayResult && selectedFit);

  const displayRoleBrief = useMemo((): RoleBrief | null => {
    if (selectedFit?.role_brief_snapshot) {
      return snapshotToRoleBrief(
        selectedFit.role_brief_snapshot as RoleBriefSnapshot,
        selectedFit.role_brief_title,
        selectedFit.role_brief_id,
      );
    }
    if (roleBrief) return roleBrief;
    return null;
  }, [selectedFit, roleBrief]);

  const cannotAssessItems = useMemo(() => {
    const brief =
      contextJobId && roleBrief ? roleBrief : displayRoleBrief;
    return (brief?.cannot_assess ?? []).filter((s) => s.trim().length > 0);
  }, [contextJobId, roleBrief, displayRoleBrief]);

  const visibleNotes = useMemo(() => {
    if (!candidate) return [];
    if (noteFilter === "all" || !contextJobId) return candidate.notes;
    return candidate.notes.filter(
      (n) => !n.job_id || n.job_id === contextJobId,
    );
  }, [candidate, noteFilter, contextJobId]);

  const jobTitleLabel =
    selectedFit?.role_brief_title ?? roleBrief?.title ?? null;

  const scoreRoleBriefId = contextJobId ?? roleBrief?.id ?? null;

  const canReEvaluate = useMemo(() => {
    if (!displayRoleBrief || !selectedFit) return false;
    if (!selectedFit.brief_content_hash) return true;
    const currentHash = computeBriefContentHash(displayRoleBrief);
    return currentHash !== selectedFit.brief_content_hash;
  }, [displayRoleBrief, selectedFit]);

  const isArchived = candidate?.tag === "archived";

  const {
    scoring: scoringFromPicker,
    error: scorePickerError,
    pickerOpen,
    pickerCandidate,
    preselectedJobId,
    requestScoreWithDefaultJob,
    confirmPicker,
    closePicker,
    runScore,
  } = useScoreCandidate(async () => {
    await load();
    onScored?.();
  });

  const scoring = scoringFromPicker;

  const handleScoreNow = async () => {
    if (!candidateId || !candidate) return;
    setError(null);
    if (scoreRoleBriefId) {
      try {
        await runScore(candidateId, scoreRoleBriefId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Scoring failed");
      }
      return;
    }
    requestScoreWithDefaultJob(
      candidateId,
      candidate.display_name,
      activeBriefId,
    );
  };

  useEffect(() => {
    if (scorePickerError) setError(scorePickerError);
  }, [scorePickerError]);

  useEffect(() => {
    setNoteFilter(contextJobId ? "role" : "all");
  }, [contextJobId]);

  useEffect(() => {
    if (!candidateId || !contextJobId) {
      setInShortlist(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/pipeline?role_brief_id=${encodeURIComponent(contextJobId)}`,
        );
        const json = await res.json();
        if (!res.ok || cancelled) return;
        const sections = json.sections as { candidates: { candidate_id: string }[] }[];
        const listed = sections[0]?.candidates ?? [];
        setInShortlist(
          listed.some((c) => c.candidate_id === candidateId),
        );
      } catch {
        if (!cancelled) setInShortlist(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [candidateId, contextJobId]);

  const handleBriefStored = useCallback(
    (brief: InterviewBrief) => {
      toast("Interview brief ready");
      setCandidate((prev) => {
        if (!prev || !selectedFitId) return prev;
        return {
          ...prev,
          role_fit_scores: prev.role_fit_scores.map((fit) =>
            fit.id === selectedFitId ? { ...fit, interview_brief: brief } : fit,
          ),
        };
      });
    },
    [selectedFitId, toast],
  );

  const addNote = async () => {
    if (!candidateId || !noteText.trim()) return;
    setNoteBusy(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: noteText.trim(),
          jobId: contextJobId ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add note");
      setNoteText("");
      await load();
      toast("Note saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add note");
    } finally {
      setNoteBusy(false);
    }
  };

  const handleDownloadOriginalCv = async () => {
    if (!candidateId || !candidate?.resume_file_path) return;
    setCvDownloadBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/resume-url`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to get download link");
      window.open(json.url as string, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to download original CV",
      );
    } finally {
      setCvDownloadBusy(false);
    }
  };

  const handleArchiveCandidate = async () => {
    if (!candidateId) return;
    setArchiveBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Archive failed");
      window.dispatchEvent(
        new CustomEvent("karta:candidate-updated", {
          detail: { id: candidateId },
        }),
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
    } finally {
      setArchiveBusy(false);
    }
  };

  const handleMoveToRole = async (roleBriefId: string) => {
    if (!candidateId) return;
    setMoveRoleBusy(true);
    setError(null);
    try {
      await runScore(candidateId, roleBriefId);
      await load();
      onScored?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Move failed");
    } finally {
      setMoveRoleBusy(false);
    }
  };

  const handleReEvaluate = async () => {
    if (!candidateId || !scoreRoleBriefId || !canReEvaluate) return;
    setReEvaluateBusy(true);
    setError(null);
    try {
      await runScore(candidateId, scoreRoleBriefId);
      await load();
      onScored?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-evaluation failed");
    } finally {
      setReEvaluateBusy(false);
    }
  };

  const handleDeleteCandidate = async () => {
    if (!candidateId) return;
    setDeleteBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      window.dispatchEvent(
        new CustomEvent("karta:candidate-deleted", {
          detail: { id: candidateId },
        }),
      );
      handlePanelClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleDownloadReport = async () => {
    const signalProfile = candidate?.signal_profile;
    if (!candidate || !displayRoleBrief || !displayResult || !signalProfile) {
      return;
    }
    setPdfBusy(true);
    try {
      downloadKartaAssessmentPdf({
        candidateName: candidate.display_name,
        roleBrief: displayRoleBrief,
        assessedAt: selectedFit?.created_at ?? new Date().toISOString(),
        result: displayResult,
        profile: signalProfile,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate PDF report",
      );
    } finally {
      setPdfBusy(false);
    }
  };

  const handleShortlist = async () => {
    if (!candidateId || !contextJobId || inShortlist) return;
    setShortlistBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_brief_id: contextJobId,
          candidate_ids: [candidateId],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Shortlist failed");
      setInShortlist(true);
      toast("Candidate added to shortlist");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Shortlist failed");
    } finally {
      setShortlistBusy(false);
    }
  };

  const handlePassConfirm = async (reason: string, detail: string | null) => {
    if (!candidateId || !contextJobId) return;
    setPassBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleBriefId: contextJobId,
          reason,
          reasonDetail: detail,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to mark not a fit");
      setPassModalOpen(false);
      toast("Candidate marked as not a fit");
      await load();
      onScored?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark not a fit");
    } finally {
      setPassBusy(false);
    }
  };

  const handleRetryParse = async () => {
    if (!candidateId) return;
    setRetryParseBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/reparse`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Retry failed");
      toast("Retrying resume parse…", "info");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetryParseBusy(false);
    }
  };

  if (!candidateId) return null;

  const profile = panelCandidate?.signal_profile ?? null;
  const verdict =
    selectedFit?.verdict ??
    (displayResult ? scoreToVerdict(displayResult.overall_score) : null);
  const intel = displayResult?.skills_intelligence;
  const contradictions = extractContradictions(displayResult);
  const confidenceLevel =
    displayResult?.confidence_level ?? displayResult?.confidence_label ?? null;
  const askThemQuestions = cannotAssessItems.slice(0, 6);

  const roleFitHistorySection = panelCandidate ? (
    <section className={`${karta.card} p-4`}>
      <h3 className={karta.sectionHeading}>Role Fit History</h3>
      {panelCandidate.role_fit_scores.length === 0 ? (
        <p className="text-sm text-[#64748B]">No scores yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-[#F1F5F9]">
          {panelCandidate.role_fit_scores.map((fit) => (
            <li
              key={fit.id}
              className="flex items-center justify-between gap-2 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-[#1E293B]">
                  {fit.role_brief_title ?? "Job role"}
                </p>
                <p className="text-xs text-[#64748B]">
                  {formatDate(fit.created_at)}
                </p>
              </div>
              <VerdictBadge
                verdict={fit.verdict as FitVerdict}
                score={fit.overall_score}
                showScore
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  ) : null;

  const renderTabContent = () => {
    if (!panelCandidate || !profile) return null;

    const statusLabel = parsingStatusLabel(panelCandidate);
    const parseFailed = panelCandidate.parsing_status === "failed";
    const parsePending =
      panelCandidate.parsing_status === "pending" ||
      (panelCandidate.parsing_status as string) === "parsing";

    const unevaluatedPlaceholder = (tabHint: string) => (
      <div className="space-y-4">
        {statusLabel && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              parseFailed
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-amber-200 bg-amber-50 text-amber-900"
            }`}
          >
            <p className="font-medium">{statusLabel}</p>
            {parseFailed && (
              <>
                <ParseFailureHelp className="mt-2" tone="red" />
                <button
                  type="button"
                  disabled={retryParseBusy}
                  onClick={() => void handleRetryParse()}
                  className={`mt-3 inline-flex items-center gap-1.5 ${karta.btnOutlineTeal} px-3 py-1.5 text-sm`}
                >
                  {retryParseBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCw className="h-3.5 w-3.5" />
                  )}
                  {retryParseBusy ? "Retrying…" : "Retry parse"}
                </button>
              </>
            )}
          </div>
        )}
        <div className={`${karta.card} p-6 text-center`}>
          <p className="text-sm font-medium text-[#1E293B]">
            {parsePending
              ? "Resume is still being processed"
              : parseFailed
                ? "Resume could not be parsed"
                : "Not yet evaluated"}
          </p>
          <p className="mt-2 text-sm text-[#64748B]">{tabHint}</p>
          {!parsePending && !parseFailed && (
            <button
              type="button"
              disabled={scoring}
              onClick={() => void handleScoreNow()}
              className={`mt-4 ${karta.btnPrimary}`}
            >
              {scoring ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analysing…
                </span>
              ) : (
                "Evaluate Now"
              )}
            </button>
          )}
        </div>
      </div>
    );

    if (activeTab === "overview") {
      if (!hasScore || !displayResult || !displayRoleBrief) {
        return (
          <div className="space-y-4">
            {unevaluatedPlaceholder(
              parsePending
                ? "Scores and recommendations will appear once parsing completes."
                : parseFailed
                  ? "Retry parsing or re-upload the resume from the profile tab."
                  : "Run an evaluation to see fit scores and recommended actions.",
            )}
            <CandidateResumeSection
              candidateId={panelCandidate.id}
              resumeText={panelCandidate.resume_text}
              resumeFilename={panelCandidate.resume_filename}
              resumeFilePath={panelCandidate.resume_file_path}
              resumeFileType={panelCandidate.resume_file_type}
            />
            {!parseFailed && roleFitHistorySection}
          </div>
        );
      }

      return (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 space-y-3 lg:w-[60%]">
            <RecommendedActionSection result={displayResult} />
            <ConfidenceIndicator confidence={displayResult.confidence} />
            {displayResult.deal_breaker_warning && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {displayResult.deal_breaker_warning}
              </p>
            )}
            <WhyThisCandidateSection
              result={displayResult}
              roleBrief={displayRoleBrief}
              cannotAssessItems={cannotAssessItems}
              variant="overview"
            />
            <CandidateResumeSection
              candidateId={panelCandidate.id}
              resumeText={panelCandidate.resume_text}
              resumeFilename={panelCandidate.resume_filename}
              resumeFilePath={panelCandidate.resume_file_path}
              resumeFileType={panelCandidate.resume_file_type}
            />
          </div>
          <div className="min-w-0 space-y-4 lg:w-[40%]">
            <DimensionDonut
              result={displayResult}
              roleBrief={displayRoleBrief}
            />
            <section className={`${karta.card} p-4`}>
              <h3 className={karta.sectionHeading}>Quick Actions</h3>
              <div className="mt-3 flex flex-col gap-2">
                {contextJobId && (
                  <button
                    type="button"
                    disabled={shortlistBusy || inShortlist || !hasScore}
                    onClick={() => void handleShortlist()}
                    className={`inline-flex items-center justify-center gap-2 ${karta.btnOutlineTeal}`}
                  >
                    {shortlistBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    {inShortlist ? "On shortlist" : "Shortlist"}
                  </button>
                )}
                {contextJobId && (
                  <button
                    type="button"
                    disabled={passBusy}
                    onClick={() => setPassModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-[#64748B] hover:bg-slate-50 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Pass
                  </button>
                )}
                {selectedFit && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("interview")}
                    className={`inline-flex items-center justify-center gap-2 ${karta.btnSecondary}`}
                  >
                    <ClipboardList className="h-4 w-4" />
                    Generate interview brief
                  </button>
                )}
              </div>
            </section>
          </div>
        </div>
      );
    }

    if (activeTab === "analysis") {
      if (!hasScore || !displayResult || !displayRoleBrief) {
        return unevaluatedPlaceholder(
          "Evaluate this candidate to see dimension scores and skills analysis.",
        );
      }

      return (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 space-y-4 lg:w-[60%]">
            <ScoreBreakdownSection
              result={displayResult}
              roleBrief={displayRoleBrief}
              colorCoded
            />
            {intel && <SkillsMatchSection intel={intel} />}
            {contradictions.length > 0 && (
              <section className="rounded-lg border-l-[3px] border-red-400 bg-gradient-to-r from-red-50/50 to-transparent p-4">
                <h3 className={`${karta.sectionHeading} section-heading-accent`}>
                  Contradictions
                </h3>
                <ul className="mt-2 space-y-2 text-sm text-[#334155]">
                  {contradictions.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          <div className="min-w-0 space-y-4 lg:w-[40%]">
            {roleFitHistorySection}
            {panelCandidate.role_fit_scores.length > 1 && (
              <ScoreHistorySection fits={panelCandidate.role_fit_scores} />
            )}
          </div>
        </div>
      );
    }

    if (activeTab === "interview") {
      if (!selectedFit || !hasScore) {
        return unevaluatedPlaceholder(
          "Evaluate this candidate before generating an interview brief.",
        );
      }

      return (
        <InterviewBriefSection
          key={selectedFit.id}
          candidateId={candidateId!}
          savedScoreId={selectedFit.id}
          candidateName={panelCandidate.display_name}
          roleTitle={selectedFit.role_brief_title ?? "Role"}
          storedBrief={selectedFit.interview_brief}
          roleBriefUpdatedAt={
            roleBrief?.scoring_prompt_generated_at ??
            roleBrief?.last_analysed_at ??
            displayRoleBrief?.scoring_prompt_generated_at ??
            displayRoleBrief?.last_analysed_at ??
            null
          }
          roleBriefCreatedAt={
            roleBrief?.created_at ?? displayRoleBrief?.created_at ?? null
          }
          onBriefStored={handleBriefStored}
          onError={setError}
          fallbackQuestions={askThemQuestions}
        />
      );
    }

    return (
      <CandidatePanelProfileTab
        candidate={panelCandidate}
        noteFilter={noteFilter}
        onNoteFilterChange={setNoteFilter}
        contextJobId={contextJobId ?? null}
        visibleNotes={visibleNotes}
        noteText={noteText}
        onNoteTextChange={setNoteText}
        noteBusy={noteBusy}
        onAddNote={() => void addNote()}
        formatDate={formatDate}
        hasResumeFile={Boolean(panelCandidate.resume_file_path)}
        cvDownloadBusy={cvDownloadBusy}
        onDownloadCv={() => void handleDownloadOriginalCv()}
        pdfBusy={pdfBusy}
        canDownloadReport={hasScore && Boolean(displayRoleBrief)}
        onDownloadReport={() => void handleDownloadReport()}
        showActions={panelCandidate.created_by === currentUserId}
        deleteConfirm={deleteConfirm}
        deleteBusy={deleteBusy}
        onDeleteConfirm={() => void handleDeleteCandidate()}
        onDeleteCancel={() => setDeleteConfirm(false)}
        onDeleteRequest={() => setDeleteConfirm(true)}
        onCandidateUpdated={() => void load()}
        onArchive={() => handleArchiveCandidate()}
        archiveBusy={archiveBusy}
        onMoveToRole={(roleId) => handleMoveToRole(roleId)}
        moveRoleBusy={moveRoleBusy}
        onReEvaluate={() => handleReEvaluate()}
        reEvaluateBusy={reEvaluateBusy}
        canReEvaluate={canReEvaluate}
        isArchived={isArchived}
      />
    );
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close panel"
        className={`fixed inset-0 z-40 bg-black/15 backdrop-blur-[2px] ${
          panelExiting ? "panel-backdrop-exit" : "panel-backdrop-enter"
        }`}
        onClick={handlePanelClose}
      />
      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[#E2E8F0] bg-white shadow-[-8px_0_32px_rgba(0,0,0,0.12)] md:w-[70%] ${
          panelExiting ? "panel-slide-exit" : "panel-slide-enter"
        }`}
        role="dialog"
        aria-modal
        aria-label="Candidate profile"
      >
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-[#0D9488]" />
          </div>
        ) : error && !candidate ? (
          <p className="p-6 text-sm text-red-600">{error}</p>
        ) : panelCandidate ? (
          <>
            <div className="sticky-header shrink-0">
              <CandidatePanelHeader
                candidate={panelCandidate}
                roleBriefTitle={jobTitleLabel ?? displayRoleBrief?.title ?? null}
                verdict={verdict}
                score={displayResult?.overall_score ?? null}
                confidenceLevel={confidenceLevel}
                onClose={handlePanelClose}
              />

              <div className="px-4 pb-2">
                {!contextJobId && historicalFits.length > 1 ? (
                  <label className="block">
                    <span className="sr-only">Evaluated against</span>
                    <select
                      value={selectedFitId ?? ""}
                      onChange={(e) => setSelectedFitId(e.target.value)}
                      className={`${karta.input} text-xs`}
                    >
                      {historicalFits.map((fit) => (
                        <option key={fit.id} value={fit.id}>
                          {fit.role_brief_title ?? "Job role"} ·{" "}
                          {formatDate(fit.created_at)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : contextJobId && jobTitleLabel ? (
                  <p className="text-xs font-medium text-[#0D9488]">
                    {jobTitleLabel}
                  </p>
                ) : null}
              </div>

              <CandidatePanelTabs active={activeTab} onChange={setActiveTab} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {error && (
                <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {error}
                </p>
              )}

              {panelCandidate.manual_rejection_reason && (
                <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                    Not a Fit
                  </p>
                  <p className="mt-0.5 text-sm text-red-700">
                    {panelCandidate.manual_rejection_reason}
                    {panelCandidate.manual_rejection_detail
                      ? ` — ${panelCandidate.manual_rejection_detail}`
                      : ""}
                  </p>
                </div>
              )}

              <div key={activeTab} className="panel-tab-content">
                {renderTabContent()}
              </div>
            </div>
          </>
        ) : null}
      </aside>

      {passModalOpen && panelCandidate && (
        <NotAFitModal
          candidateName={panelCandidate.display_name}
          onClose={() => setPassModalOpen(false)}
          onConfirm={(reason, detail) => void handlePassConfirm(reason, detail)}
        />
      )}

      {pickerOpen && pickerCandidate && (
        <ScoreRolePickerModal
          candidateName={pickerCandidate.name}
          preselectedJobId={preselectedJobId}
          onClose={closePicker}
          onConfirm={(jobId) => void confirmPicker(jobId)}
        />
      )}
    </>
  );
}
