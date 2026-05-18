"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Download, Loader2, X } from "lucide-react";
import type { CandidateDetail, CandidateSignalProfile } from "@/types/candidate";
import type { RoleBrief } from "@/types/role-brief";
import type { FitVerdict } from "@/types/score";
import { buildRoleFitSummary } from "@/lib/scoring/role-fit-summary";
import { scoreToVerdict } from "@/lib/scoring/recruiter-card";
import type { CandidateScoreResult } from "@/types/score";
import {
  ownershipLabel,
  impactEvidenceLabel,
  careerGrowthLabel,
  careerGrowthBarPercent,
  profileDepthLabel,
  profileDepthBarPercent,
} from "@/lib/candidates/signal-labels";
import {
  pickDefaultScoreId,
  scoresWithSnapshots,
} from "@/lib/candidates/pick-panel-score";
import { useActiveRoleBrief } from "@/contexts/active-role-brief-context";
import { karta } from "@/lib/brand/karta";
import { KartaMatchBreakdown } from "@/components/match/karta-match-breakdown";
import { snapshotToRoleBrief } from "@/lib/saved-scores/build-save-payload";
import { downloadKartaAssessmentPdf } from "@/lib/reports/karta-assessment-pdf";
import type { RoleBriefSnapshot } from "@/types/saved-score";
import { formatCoreStrengthLabel } from "@/lib/intelligence/skill-domains";
import { CandidateDetailsSection } from "./candidate-details-section";
import { CandidatePanelHeader } from "./candidate-panel-header";
import { SignalBar, VerdictBadge } from "./profile-shared";

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

function InsightBar({
  label,
  subtitle,
  rating,
  fillPercent,
}: {
  label: string;
  subtitle: string;
  rating: string;
  fillPercent: number;
}) {
  return (
    <div className="space-y-1">
      <SignalBar label={label} rating={rating} fillPercent={fillPercent} />
      <p className="text-[11px] leading-snug text-[#94A3B8]">{subtitle}</p>
    </div>
  );
}

function CandidateInsightsBars({ profile }: { profile: CandidateSignalProfile }) {
  return (
    <div className="space-y-4">
      <InsightBar
        label="Ownership Drive"
        subtitle="Measures first-person ownership language versus participation in team work."
        rating={ownershipLabel(profile.resume_quality.ownership.ownership_count)}
        fillPercent={profile.ownership_ratio_percent}
      />
      <InsightBar
        label="Impact Evidence"
        subtitle="Measures quantified outcomes with numbers versus vague activity descriptions."
        rating={impactEvidenceLabel(
          profile.quantification_ratio_percent,
          profile.quantification_level,
        )}
        fillPercent={profile.quantification_ratio_percent}
      />
      <InsightBar
        label="Career Growth"
        subtitle="Measures progression speed relative to typical market pace for this experience level."
        rating={careerGrowthLabel(profile.trajectory_velocity)}
        fillPercent={careerGrowthBarPercent(profile.trajectory_velocity)}
      />
      <InsightBar
        label="Profile Depth"
        subtitle="Measures whether claimed skills are demonstrated in work descriptions or listed only."
        rating={profileDepthLabel(profile.keyword_stuffing_flagged)}
        fillPercent={profileDepthBarPercent(profile.keyword_stuffing_flagged)}
      />
    </div>
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
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [cvDownloadBusy, setCvDownloadBusy] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [selectedFitId, setSelectedFitId] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<"insights" | "resume">("insights");

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
    setBreakdownOpen(false);
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

  const jobTitleLabel =
    selectedFit?.role_brief_title ?? roleBrief?.title ?? null;

  const mustHaves = useMemo(() => {
    const intel = displayResult?.skills_intelligence;
    const total =
      intel?.total_required ?? displayRoleBrief?.deal_breakers.length ?? 0;
    const met = intel?.matched_count ?? 0;
    return { met, total: Math.max(total, 1) };
  }, [displayResult, displayRoleBrief]);

  const scoreRoleBriefId = contextJobId ?? roleBrief?.id ?? activeBriefId;

  const handleScoreNow = async () => {
    if (!candidateId) return;
    if (!scoreRoleBriefId) {
      setError(
        "Select an active job role on the Job Roles page, or open this candidate from a job.",
      );
      return;
    }
    setScoring(true);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleBriefId: scoreRoleBriefId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Scoring failed");
      await load();
      onScored?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scoring failed");
    } finally {
      setScoring(false);
    }
  };

  const addNote = async () => {
    if (!candidateId || !noteText.trim()) return;
    setNoteBusy(true);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteText.trim() }),
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
  const card = displayResult?.recruiter_card;
  const verdict = displayResult
    ? scoreToVerdict(displayResult.overall_score)
    : null;
  const intel = displayResult?.skills_intelligence;

  return (
    <>
      <button
        type="button"
        aria-label="Close panel"
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />
      <aside
        className="panel-slide-in fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[#F1F5F9] bg-white shadow-xl md:w-[70%]"
        role="dialog"
        aria-modal
        aria-label="Candidate insights"
      >
        <div className="flex items-center justify-end border-b border-[#F1F5F9] px-4 py-2">
          <button
            type="button"
            onClick={onClose}
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

              <CandidatePanelHeader candidate={candidate} />

              <div className="space-y-2">
                  {contextJobId && jobTitleLabel ? (
                    <p className="mt-1 text-xs font-medium text-[#0D9488]">
                      {jobTitleLabel}
                    </p>
                  ) : null}
                  {!contextJobId && historicalFits.length > 1 ? (
                    <div className="mt-2">
                      <label className="sr-only" htmlFor="panel-job-score-select">
                        Scored against
                      </label>
                      <select
                        id="panel-job-score-select"
                        value={selectedFitId ?? ""}
                        onChange={(e) => setSelectedFitId(e.target.value)}
                        className={`${karta.input} mt-1 text-sm`}
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
                    <p className="mt-1 text-xs font-medium text-[#0D9488]">
                      {jobTitleLabel}
                      {selectedFit
                        ? ` · ${formatDate(selectedFit.created_at)}`
                        : ""}
                    </p>
                  ) : null}
                  {formatCoreStrengthLabel(
                    profile.core_strength_primary,
                    profile.core_strength_secondary,
                  ) && (
                    <p className="mt-0.5 text-[11px] font-medium text-[#0D9488]">
                      Core strength:{" "}
                      {formatCoreStrengthLabel(
                        profile.core_strength_primary,
                        profile.core_strength_secondary,
                      )
                        ?.replace(" + ", " · ")}
                    </p>
                  )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
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

              <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setPanelTab("insights")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
                    panelTab === "insights"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600"
                  }`}
                >
                  Insights
                </button>
                <button
                  type="button"
                  onClick={() => setPanelTab("resume")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${
                    panelTab === "resume"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600"
                  }`}
                >
                  Resume
                </button>
              </div>

              {panelTab === "resume" ? (
                <div className="space-y-4">
                  <section className={`${karta.card} p-4`}>
                    <h3 className={karta.sectionHeading}>Resume text</h3>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-[#334155]">
                      {candidate.resume_text}
                    </pre>
                  </section>
                  <CandidateDetailsSection
                    candidate={candidate}
                    onSaved={() => void load()}
                  />
                </div>
              ) : hasScore && displayResult && displayRoleBrief ? (
                <>
                  {displayResult.deal_breaker_warning && (
                    <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {displayResult.deal_breaker_warning}
                    </p>
                  )}

                  <section>
                    <h3 className={karta.sectionHeading}>Candidate Insights</h3>
                    <div className="mt-3">
                      <CandidateInsightsBars profile={profile} />
                    </div>
                  </section>

                  {profile.github && (
                    <GithubPresenceSection github={profile.github} />
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <VerdictBadge
                      verdict={verdict}
                      score={displayResult.overall_score}
                      showScore
                    />
                    <p className="text-sm text-[#64748B]">
                      <span className="font-semibold text-[#0D9488]">
                        {mustHaves.met}
                      </span>{" "}
                      of{" "}
                      <span className="font-semibold text-[#0D9488]">
                        {mustHaves.total}
                      </span>{" "}
                      must-haves met
                    </p>
                  </div>

                  {intel && (
                    <section className="space-y-2">
                      <div>
                        <div className="mb-1 flex justify-between text-[13px]">
                          <span className="font-medium text-[#334155]">
                            Skills matched
                          </span>
                          <span className="text-[#64748B]">
                            {intel.direct_count + intel.semantic_count} of{" "}
                            {intel.total_required}
                          </span>
                        </div>
                        <div className={karta.barTrack}>
                          <div
                            className={karta.barFill}
                            style={{
                              width: `${Math.min(100, (intel.matched_count / Math.max(1, intel.total_required)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      {intel.semantic_count > 0 && (
                        <div>
                          <div className="mb-1 flex justify-between text-[13px]">
                            <span className="font-medium text-[#334155]">
                              Smart matches
                            </span>
                            <span className="text-[#64748B]">
                              {intel.semantic_count} inferred
                            </span>
                          </div>
                          <div className={karta.barTrack}>
                            <div
                              className="h-full rounded-md bg-emerald-500"
                              style={{
                                width: `${Math.min(100, (intel.semantic_count / Math.max(1, intel.total_required)) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </section>
                  )}

                  {card && card.what_stands_out.length > 0 && (
                    <section>
                      <h3 className={karta.sectionHeading}>
                        Why This Candidate
                      </h3>
                      {displayRoleBrief && (
                        <p className="mt-2 text-sm italic text-[#64748B]">
                          {buildRoleFitSummary(displayResult, displayRoleBrief)}
                        </p>
                      )}
                      <ul className="mt-2 space-y-3">
                        {card.what_stands_out.slice(0, 3).map((item, i) => (
                          <li key={i} className="text-sm text-[#334155]">
                            <p>{item.signal}</p>
                            {item.evidence && (
                              <blockquote className="mt-1 border-l-2 border-[#0D9488] pl-3 text-xs italic text-[#64748B]">
                                &ldquo;{item.evidence}&rdquo;
                              </blockquote>
                            )}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {card && card.worth_exploring.length > 0 && (
                    <section>
                      <h3 className={karta.sectionHeading}>Watch Points</h3>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
                        {card.worth_exploring.slice(0, 2).map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {card && card.interview_questions.length > 0 && (
                    <section>
                      <h3 className={karta.sectionHeading}>Ask Them</h3>
                      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-[#334155]">
                        {card.interview_questions.slice(0, 2).map((q, i) => (
                          <li key={i}>{q}</li>
                        ))}
                      </ol>
                    </section>
                  )}

                  <button
                    type="button"
                    onClick={() => setBreakdownOpen((o) => !o)}
                    className="flex w-full items-center justify-center gap-1 border-t border-[#F1F5F9] pt-3 text-sm font-medium text-[#0D9488] hover:text-[#0B8276]"
                  >
                    See Full Breakdown
                    {breakdownOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  {breakdownOpen && (
                    <KartaMatchBreakdown
                      result={displayResult}
                      roleBrief={displayRoleBrief}
                    />
                  )}
                </>
              ) : (
                <>
                  <section>
                    <h3 className={karta.sectionHeading}>Candidate Insights</h3>
                    <div className="mt-3">
                      <CandidateInsightsBars profile={profile} />
                    </div>
                  </section>

                  {profile.github && (
                    <GithubPresenceSection github={profile.github} />
                  )}

                  <div className="rounded-lg border border-dashed border-[#0D9488]/40 bg-teal-50/50 px-4 py-5 text-center">
                    <p className="text-sm font-medium text-[#1E293B]">
                      This candidate has not been scored yet
                    </p>
                    <button
                      type="button"
                      disabled={scoring || !scoreRoleBriefId}
                      onClick={() => void handleScoreNow()}
                      className={`mt-4 ${karta.btnPrimary}`}
                    >
                      {scoring ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Scoring…
                        </span>
                      ) : (
                        "Score Now"
                      )}
                    </button>
                    {!scoreRoleBriefId && (
                      <p className="mt-2 text-xs text-[#64748B]">
                        Open from a job or set an active job role to score.
                      </p>
                    )}
                  </div>
                </>
              )}

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

              <section className={`${karta.card} p-4`}>
                <h3 className={karta.sectionHeading}>Notes</h3>
                {candidate.notes.length > 0 && (
                  <ul className="mb-3 space-y-2">
                    {candidate.notes.map((n) => (
                      <li
                        key={n.id}
                        className="rounded-md bg-[#F8FAFC] px-3 py-2 text-sm text-[#334155]"
                      >
                        <p>{n.body}</p>
                        <p className="mt-1 text-xs text-[#64748B]">
                          {formatDate(n.created_at)}
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
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
