"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { ClickableCandidateName } from "@/components/candidates/clickable-candidate-name";
import { CoreStrengthLabel } from "@/components/candidates/core-strength-label";
import { CandidateListMeta } from "@/components/candidates/candidate-list-meta";
import { ShortlistReasonModal } from "@/components/candidates/shortlist-reason-modal";
import { VerdictBadge } from "@/components/candidates/profile-shared";
import { useCandidatePanel } from "@/contexts/candidate-panel-context";
import { getScoreForRole } from "@/lib/candidates/active-role-score";
import { formatTotalExperienceDisplay } from "@/lib/candidates/format-total-experience";
import { karta } from "@/lib/brand/karta";
import { VERDICT_SORT_ORDER } from "@/lib/brand/karta";
import type { CandidateListItem } from "@/types/candidate";
import type { Job } from "@/types/job";
type JobAssessedTabProps = {
  jobId: string;
  roleBrief: Job;
};

export function JobAssessedTab({ jobId, roleBrief }: JobAssessedTabProps) {
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shortlistTarget, setShortlistTarget] = useState<CandidateListItem | null>(
    null,
  );
  const [shortlisting, setShortlisting] = useState(false);
  const [pipelineIds, setPipelineIds] = useState<Set<string>>(new Set());
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
      const pipeJson = await pipeRes.json();
      if (!candRes.ok) throw new Error(candJson.error ?? "Failed to load");
      setCandidates(candJson.candidates as CandidateListItem[]);
      const ids = new Set<string>();
      for (const section of pipeJson.sections ?? []) {
        for (const row of section.candidates ?? []) {
          ids.add(String(row.candidate_id));
        }
      }
      setPipelineIds(ids);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const assessed = useMemo(() => {
    const scored = candidates.filter((c) => c.scoring_status === "scored");
    return scored.sort((a, b) => {
      const sa = getScoreForRole(a, jobId);
      const sb = getScoreForRole(b, jobId);
      const va = sa?.verdict ?? "NOT SUITABLE";
      const vb = sb?.verdict ?? "NOT SUITABLE";
      const orderA = VERDICT_SORT_ORDER[va] ?? 99;
      const orderB = VERDICT_SORT_ORDER[vb] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return (sb?.overall_score ?? 0) - (sa?.overall_score ?? 0);
    });
  }, [candidates, jobId]);

  const confirmShortlist = async (reason: string | null) => {
    if (!shortlistTarget) return;
    setShortlisting(true);
    setError(null);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_brief_id: jobId,
          candidate_ids: [shortlistTarget.id],
          shortlist_reason: reason,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Shortlist failed");
      setPipelineIds((prev) => new Set(prev).add(shortlistTarget.id));
      setShortlistTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Shortlist failed");
    } finally {
      setShortlisting(false);
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
      <p className="text-sm text-[#64748B]">
        All candidates scored against this role, sorted by match strength.
      </p>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {assessed.length === 0 ? (
        <div className={`${karta.card} px-6 py-12 text-center text-sm text-[#64748B]`}>
          No assessed candidates yet. Score applicants from the Applicants tab.
        </div>
      ) : (
        <div className={`${karta.card} overflow-hidden`}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Experience</th>
                <th className="px-4 py-3">Match</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {assessed.map((c) => {
                const score = getScoreForRole(c, jobId);
                const inPipeline = pipelineIds.has(c.id);
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
                      <ClickableCandidateName
                        candidateId={c.id}
                        panelOptions={panelOpts}
                      >
                        {c.display_name}
                      </ClickableCandidateName>
                      <CandidateListMeta
                        currentTitle={c.current_title}
                        currentCompany={c.current_company}
                        yearsExperience={c.signal_profile.total_years_experience}
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
                      {inPipeline ? (
                        <span className="text-xs font-medium text-[#64748B]">
                          Shortlisted
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={shortlisting}
                          onClick={() => setShortlistTarget(c)}
                          className={karta.btnPrimary}
                        >
                          Shortlist
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {shortlistTarget && (
        <ShortlistReasonModal
          candidateName={shortlistTarget.display_name}
          onClose={() => setShortlistTarget(null)}
          onConfirm={(reason) => void confirmShortlist(reason)}
        />
      )}
    </div>
  );
}
