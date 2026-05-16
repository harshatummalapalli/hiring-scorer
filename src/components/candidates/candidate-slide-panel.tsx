"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, X } from "lucide-react";
import type { CandidateDetail } from "@/types/candidate";
import type { RoleBrief } from "@/types/role-brief";
import type { FitVerdict } from "@/types/score";
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
import { karta } from "@/lib/brand/karta";
import { KartaMatchBreakdown } from "@/components/match/karta-match-breakdown";
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

function roleFitSummary(result: CandidateScoreResult, roleTitle: string): string {
  const verdict = scoreToVerdict(result.overall_score);
  if (verdict === "STRONG FIT" || verdict === "POSSIBLE FIT") {
    return `This candidate shows a solid match for ${roleTitle} based on skills, experience, and career signals from their resume.`;
  }
  if (verdict === "WEAK FIT") {
    return `This candidate has some relevant background for ${roleTitle}, but gaps remain against key requirements.`;
  }
  return `This candidate does not align well with ${roleTitle} based on the requirements for this role.`;
}

type CandidateSlidePanelProps = {
  candidateId: string | null;
  activeRoleBrief: RoleBrief | null;
  onClose: () => void;
};

export function CandidateSlidePanel({
  candidateId,
  activeRoleBrief,
  onClose,
}: CandidateSlidePanelProps) {
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

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
  }, [load]);

  const activeFit = useMemo(() => {
    if (!candidate || !activeRoleBrief) return null;
    return (
      candidate.role_fit_scores.find(
        (f) => f.role_brief_id === activeRoleBrief.id,
      ) ?? null
    );
  }, [candidate, activeRoleBrief]);

  const activeResult = activeFit?.score_snapshot ?? null;

  const mustHaves = useMemo(() => {
    const intel = activeResult?.skills_intelligence;
    const total =
      intel?.total_required ??
      activeRoleBrief?.deal_breakers.length ??
      0;
    const met = intel?.matched_count ?? 0;
    return { met, total: Math.max(total, 1) };
  }, [activeResult, activeRoleBrief]);

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

  if (!candidateId) return null;

  const profile = candidate?.signal_profile;
  const card = activeResult?.recruiter_card;
  const verdict = activeResult
    ? scoreToVerdict(activeResult.overall_score)
    : null;
  const intel = activeResult?.skills_intelligence;

  return (
    <>
      <button
        type="button"
        aria-label="Close panel"
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-[#F1F5F9] bg-white shadow-xl"
        role="dialog"
        aria-modal
        aria-label="Candidate insights"
      >
        <div className="flex items-center justify-between border-b border-[#F1F5F9] px-4 py-3">
          <h2 className="truncate pr-2 text-base font-semibold text-[#1E293B]">
            {candidate?.display_name ?? "Candidate"}
          </h2>
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

              {activeResult && activeRoleBrief ? (
                <>
                  <p className="text-sm text-[#64748B]">
                    Assessed across{" "}
                    <span className="font-semibold text-[#0D9488]">5</span>{" "}
                    dimensions ·{" "}
                    <span className="font-semibold text-[#0D9488]">
                      {mustHaves.met}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-[#0D9488]">
                      {mustHaves.total}
                    </span>{" "}
                    must-haves met
                  </p>

                  <section>
                    <h3 className={karta.sectionHeading}>Candidate Insights</h3>
                    <div className="mt-3 space-y-3">
                      <SignalBar
                        label="Ownership Drive"
                        rating={ownershipLabel(
                          profile.resume_quality.ownership.ownership_count,
                        )}
                        fillPercent={profile.ownership_ratio_percent}
                      />
                      <SignalBar
                        label="Impact Evidence"
                        rating={impactEvidenceLabel(
                          profile.quantification_ratio_percent,
                          profile.quantification_level,
                        )}
                        fillPercent={profile.quantification_ratio_percent}
                      />
                      <SignalBar
                        label="Career Growth"
                        rating={careerGrowthLabel(profile.trajectory_velocity)}
                        fillPercent={careerGrowthBarPercent(
                          profile.trajectory_velocity,
                        )}
                      />
                      <SignalBar
                        label="Profile Depth"
                        rating={profileDepthLabel(
                          profile.keyword_stuffing_flagged,
                        )}
                        fillPercent={profileDepthBarPercent(
                          profile.keyword_stuffing_flagged,
                        )}
                      />
                    </div>
                    <div className="mt-3 flex justify-end">
                      <VerdictBadge
                        verdict={verdict}
                        score={activeResult.overall_score}
                        compact
                      />
                    </div>
                  </section>

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

                  <p className="text-sm italic text-[#64748B]">
                    {roleFitSummary(activeResult, activeRoleBrief.title)}
                  </p>

                  {card && card.what_stands_out.length > 0 && (
                    <section>
                      <h3 className={karta.sectionHeading}>
                        Why This Candidate
                      </h3>
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
                  {breakdownOpen && activeRoleBrief && (
                    <KartaMatchBreakdown
                      result={activeResult}
                      roleBrief={activeRoleBrief}
                    />
                  )}
                </>
              ) : (
                <p className="rounded-lg border border-dashed border-[#F1F5F9] px-4 py-6 text-center text-sm text-[#64748B]">
                  {activeRoleBrief
                    ? "Not matched against the active job role yet. Use Match in the table."
                    : "Set an active job role to view match details."}
                </p>
              )}

              <section className={`${karta.card} p-4`}>
                <h3 className={karta.sectionHeading}>Role Fit History</h3>
                {candidate.role_fit_scores.length === 0 ? (
                  <p className="text-sm text-[#64748B]">No matches yet.</p>
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
                          compact
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
