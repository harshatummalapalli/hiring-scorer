// Legacy — replaced by JobPipelineTab

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { CandidateIdentityCard } from "@/components/candidates/candidate-identity-card";
import { CoreStrengthLabel } from "@/components/candidates/core-strength-label";
import { SkipReasonModal } from "@/components/candidates/skip-reason-modal";
import { VerdictBadge } from "@/components/candidates/profile-shared";
import { useCandidatePanel } from "@/contexts/candidate-panel-context";
import { getScoreForRole } from "@/lib/candidates/active-role-score";
import { matchesVerdictFilterForRole } from "@/lib/candidates/list-filters";
import { CANDIDATE_VERDICT_FILTER_OPTIONS } from "@/lib/candidates/verdict-filter-options";
import { formatTotalExperienceDisplay } from "@/lib/candidates/format-total-experience";
import { EmptyState } from "@/components/ui/empty-state";
import { karta } from "@/lib/brand/karta";
import { VERDICT_SORT_ORDER } from "@/lib/brand/karta";
import type {
  CandidateListItem,
  CandidateVerdictFilter,
} from "@/types/candidate";
import type { Job } from "@/types/job";

type JobAssessedTabProps = {
  jobId: string;
  roleBrief: Job;
};

export function JobAssessedTab({ jobId, roleBrief }: JobAssessedTabProps) {
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skipTarget, setSkipTarget] = useState<CandidateListItem | null>(null);
  const [shortlisting, setShortlisting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [pipelineIds, setPipelineIds] = useState<Set<string>>(new Set());
  const [optimisticShortlistedIds, setOptimisticShortlistedIds] = useState<
    Set<string>
  >(new Set());
  const [skippedOpen, setSkippedOpen] = useState(false);
  const [verdictFilter, setVerdictFilter] =
    useState<CandidateVerdictFilter>("all");
  const { openPanel } = useCandidatePanel();

  const panelOpts = useMemo(
    () => ({ contextJobId: jobId, roleBrief }),
    [jobId, roleBrief],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [candRes, pipeRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}/candidates`),
        fetch(`/api/pipeline?role_brief_id=${encodeURIComponent(jobId)}`),
      ]);
      const candJson = await candRes.json();
      if (!candRes.ok) throw new Error(candJson.error ?? "Failed to load");
      setCandidates(candJson.candidates as CandidateListItem[]);
      // Only update pipeline IDs when the pipeline fetch actually succeeded
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
      const detail = (e as CustomEvent<{ jobId?: string }>).detail;
      if (detail?.jobId && detail.jobId !== jobId) return;
      void load();
    };
    window.addEventListener("karta:job-scores-recomputed", handler);
    return () =>
      window.removeEventListener("karta:job-scores-recomputed", handler);
  }, [jobId, load]);

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

  const assessed = useMemo(() => {
    const scored = candidates.filter(
      (c) =>
        c.scoring_status === "scored" &&
        !pipelineIds.has(String(c.id)) &&
        !optimisticShortlistedIds.has(String(c.id)) &&
        matchesVerdictFilterForRole(c, verdictFilter, jobId),
    );
    return scored.sort((a, b) => {
      const sa = getScoreForRole(a, jobId);
      const sb = getScoreForRole(b, jobId);
      const va = sa?.verdict ?? "NOT A MATCH";
      const vb = sb?.verdict ?? "NOT A MATCH";
      const orderA = VERDICT_SORT_ORDER[va] ?? 99;
      const orderB = VERDICT_SORT_ORDER[vb] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return (sb?.overall_score ?? 0) - (sa?.overall_score ?? 0);
    });
  }, [candidates, jobId, pipelineIds, optimisticShortlistedIds, verdictFilter]);

  const skipped = useMemo(
    () => candidates.filter((c) => c.scoring_status === "skipped"),
    [candidates],
  );

  const shortlistCandidate = async (target: CandidateListItem) => {
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
      // Immediately lock this candidate out of the Assessed list via both paths
      setPipelineIds((prev) => new Set(prev).add(targetId));
    } catch (err) {
      setOptimisticShortlistedIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
      setError(
        err instanceof Error
          ? err.message
          : "Shortlist failed — candidate restored to Assessed",
      );
    } finally {
      setShortlisting(false);
    }
  };

  const confirmSkip = async (reason: string, detail: string | null) => {
    if (!skipTarget) return;
    setSkipping(true);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${skipTarget.id}/skip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleBriefId: jobId,
          skipReason: reason,
          skipReasonDetail: detail,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Skip failed");
      setSkipTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Skip failed");
    } finally {
      setSkipping(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#64748B]">
          All candidates evaluated against this role, sorted by match strength.
        </p>
        <select
          value={verdictFilter}
          onChange={(e) =>
            setVerdictFilter(e.target.value as CandidateVerdictFilter)
          }
          className={karta.input}
          aria-label="Filter by verdict"
        >
          {CANDIDATE_VERDICT_FILTER_OPTIONS.filter(
            (opt) => opt.value !== "unscored",
          ).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {assessed.length === 0 ? (
        <EmptyState
          illustration="people"
          heading="No assessed candidates yet"
          subtitle="Evaluate applicants from the Applicants tab to see match results here."
        />
      ) : (
        <div className={`${karta.card} overflow-hidden`}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={karta.tableHeadRow}>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Experience</th>
                <th className="px-4 py-3">Match</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {assessed.map((c) => {
                const score = getScoreForRole(c, jobId);
                return (
                  <tr
                    key={c.id}
                    className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button")) return;
                      openPanel(c.id, panelOpts);
                    }}
                  >
                    <td className="px-4 py-3">
                      <CandidateIdentityCard
                        displayName={c.display_name}
                        candidateId={c.id}
                        panelOptions={panelOpts}
                        currentTitle={c.current_title}
                        currentCompany={c.current_company}
                        yearsExperience={c.signal_profile.total_years_experience}
                        experienceYears={c.signal_profile.experience_years}
                        location={c.signal_profile.location}
                        scoredJobTitle={roleBrief.title}
                        showExperienceWhenNoTitle
                        showMetaRow={false}
                      />
                      <CoreStrengthLabel
                        primary={c.signal_profile.core_strength_primary}
                        secondary={c.signal_profile.core_strength_secondary}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatTotalExperienceDisplay(
                        c.signal_profile.total_years_experience,
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {score && (
                        <VerdictBadge
                          verdict={score.verdict}
                          score={score.overall_score}
                          compact
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={shortlisting || skipping}
                          onClick={() => void shortlistCandidate(c)}
                          className={karta.btnPrimary}
                        >
                          Shortlist
                        </button>
                        <button
                          type="button"
                          disabled={shortlisting || skipping}
                          onClick={() => setSkipTarget(c)}
                          className={karta.btnSecondary}
                        >
                          Skip
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {skipped.length > 0 && (
        <section className={`${karta.card} overflow-hidden`}>
          <button
            type="button"
            onClick={() => setSkippedOpen((o) => !o)}
            className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
          >
            <span className="text-base font-semibold text-slate-900">
              Skipped ({skipped.length})
            </span>
            {skippedOpen ? (
              <ChevronDown className="h-5 w-5 text-slate-500" />
            ) : (
              <ChevronRight className="h-5 w-5 text-slate-500" />
            )}
          </button>
          {skippedOpen && (
            <div className="border-t border-slate-200">
              <table className="w-full text-left text-sm">
                <tbody>
                  {skipped.map((c) => {
                    const score = getScoreForRole(c, jobId);
                    return (
                      <tr
                        key={c.id}
                        className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                        onClick={() => openPanel(c.id, panelOpts)}
                      >
                        <td className="px-4 py-3">
                          <CandidateIdentityCard
                            displayName={c.display_name}
                            candidateId={c.id}
                            panelOptions={panelOpts}
                            currentTitle={c.current_title}
                            currentCompany={c.current_company}
                            yearsExperience={c.signal_profile.total_years_experience}
                            experienceYears={c.signal_profile.experience_years}
                            showMetaRow={false}
                          />
                        </td>
                        <td className="px-4 py-3">
                          {score && (
                            <VerdictBadge
                              verdict={score.verdict}
                              score={score.overall_score}
                              compact
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {skipTarget && (
        <SkipReasonModal
          candidateName={skipTarget.display_name}
          onClose={() => setSkipTarget(null)}
          onConfirm={(reason, detail) => void confirmSkip(reason, detail)}
        />
      )}
    </div>
  );
}
