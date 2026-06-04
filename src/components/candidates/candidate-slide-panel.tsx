"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, Trash2, X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { CandidateDetail, CandidateSignalProfile } from "@/types/candidate";
import type { RoleBrief } from "@/types/role-brief";
import type { FitVerdict } from "@/types/score";
import { scoreToVerdict } from "@/lib/scoring/recruiter-card";
import type { CandidateScoreResult } from "@/types/score";
import {
  ownershipLabel,
  ownershipScore,
  ownershipWhy,
  impactEvidenceLabel,
  impactScore,
  impactWhy,
  careerGrowthLabel,
  careerGrowthScore,
  careerGrowthWhy,
  profileDepthLabel,
  profileDepthScore,
  profileDepthWhy,
} from "@/lib/candidates/signal-labels";
import {
  pickDefaultScoreId,
  scoresWithSnapshots,
} from "@/lib/candidates/pick-panel-score";
import { useActiveRoleBrief } from "@/contexts/active-role-brief-context";
import { karta } from "@/lib/brand/karta";
import { snapshotToRoleBrief } from "@/lib/saved-scores/build-save-payload";
import { downloadKartaAssessmentPdf } from "@/lib/reports/karta-assessment-pdf";
import type { RoleBriefSnapshot } from "@/types/saved-score";
import { SignalScoreCard } from "@/components/ui/signal-score-card";
import { SlidingTabs } from "@/components/ui/sliding-tabs";
import { CandidateDetailsSection } from "./candidate-details-section";
import { CandidatePanelHeader } from "./candidate-panel-header";
import { ScoreRolePickerModal } from "./score-role-picker-modal";
import { useScoreCandidate } from "@/lib/candidates/use-score-candidate";
import { VerdictBadge } from "./profile-shared";
import { CandidatePitchCard } from "@/components/pipeline/candidate-pitch-card";
import { DimensionDonut } from "@/components/candidates/dimension-donut";
import { ScoreBreakdownSection } from "@/components/candidates/score-breakdown-section";
import { SkillsMatchSection } from "@/components/candidates/skills-match-section";
import { WhyThisCandidateSection } from "@/components/candidates/why-this-candidate-section";
import { InterviewBriefSection } from "@/components/candidates/interview-brief-section";
import type { InterviewBrief } from "@/types/score";

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

function CandidateInsightsBars({
  profile,
  animate,
}: {
  profile: CandidateSignalProfile;
  animate: boolean;
}) {
  const ownershipCount =
    profile.resume_quality?.ownership?.ownership_count ?? 0;
  const ownershipRatio = profile.ownership_ratio_percent ?? 0;
  const impactRatio = profile.quantification_ratio_percent;
  const impactLevel = profile.quantification_level ?? "rarely";
  const velocity = profile.trajectory_velocity ?? "normal";
  const keywordFlagged = profile.keyword_stuffing_flagged ?? false;
  const verifiedCount = (profile.skills_verified ?? []).length;
  const listedCount = (profile.skills_listed_only ?? []).length;

  const oScore = ownershipScore(ownershipCount, ownershipRatio);
  const iScore = impactScore(impactRatio, impactLevel);
  const gScore = careerGrowthScore(velocity);
  const dScore = profileDepthScore(keywordFlagged, verifiedCount, listedCount);

  return (
    <div className="space-y-3">
      <SignalScoreCard
        label="Ownership Drive"
        score={oScore}
        wordLabel={ownershipLabel(ownershipCount)}
        why={ownershipWhy(oScore, ownershipCount, ownershipRatio)}
        animate={animate}
        delayMs={0}
      />
      <SignalScoreCard
        label="Impact Evidence"
        score={iScore}
        wordLabel={impactEvidenceLabel(impactRatio, impactLevel)}
        why={impactWhy(iScore, impactRatio, impactLevel)}
        animate={animate}
        delayMs={100}
      />
      <SignalScoreCard
        label="Career Growth"
        score={gScore}
        wordLabel={careerGrowthLabel(velocity)}
        why={careerGrowthWhy(gScore, velocity)}
        animate={animate}
        delayMs={200}
      />
      <SignalScoreCard
        label="Profile Depth"
        score={dScore}
        wordLabel={profileDepthLabel(keywordFlagged)}
        why={profileDepthWhy(dScore, keywordFlagged, verifiedCount, listedCount)}
        animate={animate}
        delayMs={300}
      />
    </div>
  );
}

function CandidateInsightsProfileExtras({
  profile,
}: {
  profile: CandidateSignalProfile;
}) {
  const careerSequence = profile.career_types_sequence ?? [];
  const education = profile.education ?? [];

  return (
    <>
      {careerSequence.length > 0 && (
        <section>
          <h3 className={karta.sectionHeading}>Career Path</h3>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
            {careerSequence.map((type, i) => (
              <Fragment key={i}>
                {i > 0 && <span className="text-[#94A3B8]">→</span>}
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-[#334155]">
                  {type}
                </span>
              </Fragment>
            ))}
          </div>
          {profile.shows_product_progression && (
            <p className="mt-1.5 text-[11px] text-[#0D9488]">
              ✓ Product company progression
            </p>
          )}
        </section>
      )}
      {education.length > 0 && (
        <section>
          <h3 className={karta.sectionHeading}>Education</h3>
          <ul className="mt-2 space-y-1.5">
            {education.map((edu, i) => (
              <li key={i} className="text-sm text-[#334155]">
                <span className="font-medium">
                  {edu.degree ?? "Degree"}
                  {edu.field ? ` in ${edu.field}` : ""}
                </span>
                <span className="text-[#64748B]">
                  {" "}
                  · {edu.institution}
                  {edu.year ? `, ${edu.year}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function GithubPresenceSection({
  github,
}: {
  github: NonNullable<CandidateSignalProfile["github"]>;
}) {
  return (
    <section>
      <h3 className={karta.sectionHeading}>Technical Presence</h3>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-[#64748B]">Activity</dt>
          <dd
            className={
              github.is_active ? "font-medium text-emerald-700" : "text-[#94A3B8]"
            }
          >
            {github.is_active ? "Active" : "Inactive"}
          </dd>
        </div>
        <div>
          <dt className="text-[#64748B]">Top languages</dt>
          <dd className="mt-1 flex flex-wrap gap-1">
            {github.top_languages.length === 0 ? (
              <span className="text-[#94A3B8]">—</span>
            ) : (
              github.top_languages.map((lang) => (
                <span
                  key={lang}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-[#334155]"
                >
                  {lang}
                </span>
              ))
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[#64748B]">Public repos</dt>
          <dd className="font-medium text-[#1E293B]">{github.public_repos}</dd>
        </div>
        {github.most_starred_repo && (
          <div className="flex justify-between gap-4">
            <dt className="text-[#64748B]">Most starred project</dt>
            <dd className="font-medium text-[#1E293B]">
              {github.most_starred_repo.name} ({github.most_starred_repo.stars} ★)
            </dd>
          </div>
        )}
      </dl>
      <p className="mt-2 text-[11px] text-[#94A3B8]">From public GitHub profile.</p>
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
  const [panelTab, setPanelTab] = useState<"insights" | "resume">("insights");
  const [panelExiting, setPanelExiting] = useState(false);
  const [insightsAnimateKey, setInsightsAnimateKey] = useState(0);
  const [inShortlist, setInShortlist] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [noteFilter, setNoteFilter] = useState<"all" | "role">(
    contextJobId ? "role" : "all",
  );

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
      setInsightsAnimateKey((k) => k + 1);
      setDeleteConfirm(false);
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
    [selectedFitId],
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

  if (!candidateId) return null;

  const profile = candidate?.signal_profile;
  const insightsAnimate =
    panelTab === "insights" && !loading && Boolean(profile);
  const verdict = selectedFit?.verdict ?? (displayResult
    ? scoreToVerdict(displayResult.overall_score)
    : null);
  const intel = displayResult?.skills_intelligence;

  const roleFitHistorySection = candidate ? (
    <section className={`${karta.card} p-4`}>
      <h3 className={karta.sectionHeading}>Role Fit History</h3>
      {candidate.role_fit_scores.length === 0 ? (
        <p className="text-sm text-[#64748B]">No scores yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-[#F1F5F9]">
          {candidate.role_fit_scores.map((fit) => (
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

  const notesSection = (
    <section className={`${karta.card} p-4`}>
      <h3 className={karta.sectionHeading}>Notes</h3>
      {contextJobId && (
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setNoteFilter("all")}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              noteFilter === "all"
                ? "bg-[#0D9488] text-white"
                : "bg-slate-100 text-[#64748B] hover:bg-slate-200"
            }`}
          >
            All notes
          </button>
          <button
            type="button"
            onClick={() => setNoteFilter("role")}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              noteFilter === "role"
                ? "bg-[#0D9488] text-white"
                : "bg-slate-100 text-[#64748B] hover:bg-slate-200"
            }`}
          >
            This role
          </button>
        </div>
      )}
      {visibleNotes.length > 0 && (
        <ul className="mb-3 space-y-2">
          {visibleNotes.map((n) => (
            <li
              key={n.id}
              className="rounded-md bg-[#F8FAFC] px-3 py-2 text-sm text-[#334155]"
            >
              <p>{n.body}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#64748B]">
                <span>{formatDate(n.created_at)}</span>
                {n.job_id && contextJobId === n.job_id ? (
                  <span className="text-[10px] text-[#0D9488]">This role</span>
                ) : n.job_id ? (
                  <span className="text-[10px] text-[#94A3B8]">Other role</span>
                ) : (
                  <span className="text-[10px] text-[#94A3B8]">General</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
      <textarea
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        rows={3}
        placeholder="Add a note…"
        className={karta.input}
      />
      <button
        type="button"
        disabled={noteBusy || !noteText.trim()}
        onClick={() => void addNote()}
        className={`mt-2 ${karta.btnPrimary}`}
      >
        {noteBusy ? "Saving…" : "Add note"}
      </button>
    </section>
  );

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
        aria-label="Candidate insights"
      >
        <div className="flex items-center justify-end border-b border-[#E2E8F0] px-4 py-2">
          <button
            type="button"
            onClick={handlePanelClose}
            className="rounded-md p-1.5 text-[#64748B] hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-[#0D9488]" />
            </div>
          ) : error && !candidate ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : candidate && profile ? (
            <div className="space-y-5">
              {error && (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {error}
                </p>
              )}

              <div className="sticky top-0 z-10 -mx-4 border-b border-[#F1F5F9] bg-white px-4 pb-4">
                <CandidatePanelHeader
                  candidate={candidate}
                  roleBriefTitle={jobTitleLabel ?? displayRoleBrief?.title ?? null}
                  verdict={verdict}
                  score={displayResult?.overall_score ?? null}
                />

                <div className="mt-2 space-y-2">
                  {contextJobId && jobTitleLabel ? (
                    <p className="text-xs font-medium text-[#0D9488]">
                      {jobTitleLabel}
                    </p>
                  ) : null}
                  {!contextJobId && historicalFits.length > 1 ? (
                    <div>
                      <label className="sr-only" htmlFor="panel-job-score-select">
                        Evaluated against
                      </label>
                      <select
                        id="panel-job-score-select"
                        value={selectedFitId ?? ""}
                        onChange={(e) => setSelectedFitId(e.target.value)}
                        className={`${karta.input} text-sm`}
                      >
                        {historicalFits.map((fit) => (
                          <option key={fit.id} value={fit.id}>
                            {fit.role_brief_title ?? "Job role"} ·{" "}
                            {formatDate(fit.created_at)}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : !contextJobId && jobTitleLabel && hasScore ? (
                    <p className="text-xs font-medium text-[#0D9488]">
                      {jobTitleLabel}
                      {selectedFit
                        ? ` · ${formatDate(selectedFit.created_at)}`
                        : ""}
                    </p>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  {candidate.resume_file_path ? (
                    <button
                      type="button"
                      disabled={cvDownloadBusy}
                      onClick={() => void handleDownloadOriginalCv()}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0D9488] hover:text-[#0B8276] disabled:opacity-50"
                    >
                      {cvDownloadBusy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      Download Original CV
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={
                      pdfBusy ||
                      loading ||
                      !hasScore ||
                      !displayRoleBrief ||
                      !candidate
                    }
                    onClick={() => void handleDownloadReport()}
                    className={`inline-flex shrink-0 items-center gap-1.5 ${karta.btnOutlineTeal} px-2.5 py-1.5 text-xs`}
                  >
                    {pdfBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Download Report
                  </button>
                </div>

                <div className="mt-3">
                  <SlidingTabs
                    tabs={[
                      { id: "insights", label: "Insights" },
                      { id: "resume", label: "Resume" },
                    ]}
                    value={panelTab}
                    onChange={setPanelTab}
                  />
                </div>
              </div>

              {candidate.manual_rejection_reason && (
                <div className="mx-0 mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                    Not a Fit
                  </p>
                  <p className="mt-0.5 text-sm text-red-700">
                    {candidate.manual_rejection_reason}
                    {candidate.manual_rejection_detail
                      ? ` — ${candidate.manual_rejection_detail}`
                      : ""}
                  </p>
                  {candidate.manually_rejected_at && (
                    <p className="mt-0.5 text-[11px] text-red-400">
                      {formatDate(candidate.manually_rejected_at)}
                    </p>
                  )}
                </div>
              )}

              {panelTab === "resume" ? (
                <div className="space-y-4">

                  {/* Work History */}
                  {(candidate.signal_profile?.experience?.length ?? 0) > 0 && (
                    <section className={`${karta.card} p-4`}>
                      <h3 className={karta.sectionHeading}>Work History</h3>
                      <ol className="mt-3 space-y-4">
                        {candidate.signal_profile.experience.map((exp, i) => (
                          <li key={i} className="border-l-2 border-slate-100 pl-3">
                            <p className="font-semibold text-sm text-[#1E293B]">{exp.title}</p>
                            <p className="text-xs text-[#64748B]">
                              {exp.company}
                              {exp.start_date ? ` · ${exp.start_date}` : ""}
                              {exp.end_date ? ` – ${exp.end_date}` : ""}
                            </p>
                            {(exp.bullets?.length ?? 0) > 0 && (
                              <ul className="mt-1.5 space-y-1">
                                {exp.bullets.slice(0, 4).map((b, j) => (
                                  <li key={j} className="text-xs text-[#334155] leading-relaxed">
                                    · {b}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}

                  {/* Education */}
                  {(candidate.signal_profile?.education?.length ?? 0) > 0 && (
                    <section className={`${karta.card} p-4`}>
                      <h3 className={karta.sectionHeading}>Education</h3>
                      <ul className="mt-3 space-y-2">
                        {candidate.signal_profile.education.map((ed, i) => (
                          <li key={i} className="text-sm">
                            <p className="font-medium text-[#1E293B]">{ed.institution}</p>
                            <p className="text-xs text-[#64748B]">
                              {[ed.degree, ed.field, ed.year].filter(Boolean).join(" · ")}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  <CandidateDetailsSection
                    candidate={candidate}
                    onSaved={() => void load()}
                  />
                </div>
              ) : hasScore && displayResult && displayRoleBrief ? (
                <div className="space-y-4 pt-2">
                  {displayResult.deal_breaker_warning && (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {displayResult.deal_breaker_warning}
                    </p>
                  )}

                  {inShortlist && selectedFit && (
                    <CandidatePitchCard
                      candidate={{
                        id: "",
                        role_brief_id: contextJobId ?? "",
                        candidate_id: candidate.id,
                        candidate_name: candidate.display_name,
                        email: candidate.application_email,
                        phone: candidate.application_phone,
                        location: candidate.application_location,
                        fit_score: selectedFit.overall_score,
                        fit_verdict: selectedFit.verdict,
                        insights: { signals: [] },
                        relocation: null,
                        present_salary: null,
                        expected_salary: null,
                        recruiter_notes: null,
                        custom_fields: {},
                        added_at: "",
                        created_by: null,
                      }}
                      score={selectedFit}
                    />
                  )}

                  <div className="flex flex-col gap-6 lg:flex-row">
                    <div className="min-w-0 space-y-5 lg:flex-[3]">
                      <WhyThisCandidateSection
                        result={displayResult}
                        roleBrief={displayRoleBrief}
                        cannotAssessItems={cannotAssessItems}
                      />
                      <ScoreBreakdownSection
                        result={displayResult}
                        roleBrief={displayRoleBrief}
                      />
                      {intel && <SkillsMatchSection intel={intel} />}
                      {selectedFit && candidateId && (
                        <InterviewBriefSection
                          key={selectedFit.id}
                          candidateId={candidateId}
                          savedScoreId={selectedFit.id}
                          candidateName={candidate.display_name}
                          roleTitle={
                            selectedFit.role_brief_title ?? "Role"
                          }
                          storedBrief={selectedFit.interview_brief}
                          onBriefStored={handleBriefStored}
                          onError={setError}
                        />
                      )}
                    </div>

                    <div className="min-w-0 space-y-5 lg:flex-[2]">
                      <CandidateDetailsSection
                        candidate={candidate}
                        onSaved={() => void load()}
                      />
                      <DimensionDonut
                        result={displayResult}
                        roleBrief={displayRoleBrief}
                      />
                      {roleFitHistorySection}
                      {notesSection}
                    </div>
                  </div>
                </div>
              ) : panelTab === "insights" ? (
                <div className="flex flex-col gap-6 pt-2 lg:flex-row">
                  <div className="min-w-0 space-y-5 lg:flex-[3]">
                    <section>
                      <h3 className={karta.sectionHeading}>Candidate Insights</h3>
                      <div className="mt-3">
                        <CandidateInsightsBars
                          key={insightsAnimateKey}
                          profile={profile}
                          animate={insightsAnimate}
                        />
                      </div>
                    </section>
                    <CandidateInsightsProfileExtras profile={profile} />
                    {profile.github && (
                      <GithubPresenceSection github={profile.github} />
                    )}
                    <div className="rounded-lg border border-dashed border-[#0D9488]/40 bg-teal-50/50 px-4 py-5 text-center">
                      <p className="text-sm font-medium text-[#1E293B]">
                        This candidate has not been evaluated yet
                      </p>
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
                    </div>
                  </div>
                  <div className="min-w-0 space-y-5 lg:flex-[2]">
                    {roleFitHistorySection}
                    {notesSection}
                  </div>
                </div>
              ) : null}

              {candidateId &&
                candidate &&
                candidate.created_by === currentUserId && (
                  <section className="border-t border-slate-200 pt-6">
                    {!deleteConfirm ? (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(true)}
                        className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete candidate
                      </button>
                    ) : (
                      <div className="space-y-3 rounded-lg border border-red-200 bg-red-50/50 p-4">
                        <p className="text-sm text-[#334155]">
                          This will permanently remove this candidate and all
                          their evaluation data. This cannot be undone.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={deleteBusy}
                            onClick={() => void handleDeleteCandidate()}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {deleteBusy ? "Deleting…" : "Yes, delete"}
                          </button>
                          <button
                            type="button"
                            disabled={deleteBusy}
                            onClick={() => setDeleteConfirm(false)}
                            className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#64748B] hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                )}
            </div>
          ) : candidate ? (
            <p className="text-sm text-[#64748B]">
              Profile data is still loading or unavailable for this candidate.
              Try closing and reopening the panel, or re-upload the resume.
            </p>
          ) : null}
        </div>
      </aside>
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
