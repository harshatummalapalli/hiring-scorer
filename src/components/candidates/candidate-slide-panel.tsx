"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import type { CandidateDetail } from "@/types/candidate";
import type { RoleBrief } from "@/types/role-brief";
import {
  ownershipLabel,
  quantificationLabel,
  trajectoryBarPercent,
  trajectoryLabel,
} from "@/lib/candidates/signal-labels";
import { CandidateScoreCard } from "@/components/score/candidate-score-card";
import { SignalBar, VERDICT_BADGE } from "./profile-shared";

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

  return (
    <>
      <button
        type="button"
        aria-label="Close panel"
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-modal
        aria-label="Candidate hiring signals"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="truncate pr-2 text-base font-semibold text-slate-900">
            {candidate?.display_name ?? "Candidate"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
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

              <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Hiring intelligence
                </h3>
                <div className="space-y-3">
                  <SignalBar
                    label="Ownership Language"
                    rating={ownershipLabel(
                      profile.resume_quality.ownership.ownership_count,
                    )}
                    fillPercent={profile.ownership_ratio_percent}
                  />
                  <SignalBar
                    label="Quantification Quality"
                    rating={quantificationLabel(
                      profile.quantification_ratio_percent,
                      profile.quantification_level,
                    )}
                    fillPercent={profile.quantification_ratio_percent}
                  />
                  <SignalBar
                    label="Career Trajectory"
                    rating={trajectoryLabel(profile.trajectory_velocity)}
                    fillPercent={trajectoryBarPercent(
                      profile.trajectory_velocity,
                    )}
                  />
                  <SignalBar
                    label="Keyword Risk"
                    rating={profile.keyword_stuffing_flagged ? "High" : "Low"}
                    fillPercent={profile.keyword_stuffing_flagged ? 90 : 15}
                    note={
                      profile.keyword_stuffing_flagged
                        ? profile.keyword_stuffing_explanation
                        : undefined
                    }
                  />
                </div>
              </section>

              {activeFit?.score_snapshot && activeRoleBrief ? (
                <CandidateScoreCard
                  result={activeFit.score_snapshot}
                  roleBrief={activeRoleBrief}
                  candidateFilename={
                    candidate.resume_filename ?? candidate.display_name
                  }
                  hideHeader
                  compact
                />
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-600">
                  {activeRoleBrief
                    ? "Not scored against the active role yet. Use Score in the table."
                    : "Select an active role brief to view a score card."}
                </p>
              )}

              <section className="rounded-lg border border-slate-200 p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Role fit history
                </h3>
                {candidate.role_fit_scores.length === 0 ? (
                  <p className="text-sm text-slate-500">No scores yet.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {candidate.role_fit_scores.map((fit) => {
                      const styles = VERDICT_BADGE[fit.verdict];
                      return (
                        <li
                          key={fit.id}
                          className="flex items-center justify-between gap-2 py-2.5 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">
                              {fit.role_brief_title ?? "Role brief"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatDate(fit.created_at)}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles.bg} ${styles.text} ${styles.ring}`}
                          >
                            {fit.verdict} · {fit.overall_score}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="rounded-lg border border-slate-200 p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Notes
                </h3>
                {candidate.notes.length > 0 && (
                  <ul className="mb-3 space-y-2">
                    {candidate.notes.map((n) => (
                      <li
                        key={n.id}
                        className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-800"
                      >
                        <p>{n.body}</p>
                        <p className="mt-1 text-xs text-slate-500">
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
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={noteBusy || !noteText.trim()}
                  onClick={() => void addNote()}
                  className="mt-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
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
