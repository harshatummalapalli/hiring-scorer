"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { ClickableCandidateName } from "@/components/candidates/clickable-candidate-name";
import { useCandidatePanel } from "@/contexts/candidate-panel-context";
import { karta } from "@/lib/brand/karta";
import type { Job } from "@/types/job";

type TalentMatch = {
  candidateId: string;
  candidateName: string;
  yearsExperience: string;
  matchPercent: number;
  previousRoleTitle: string;
  previousRoleId: string | null;
};

type JobTalentPoolTabProps = {
  jobId: string;
  jobTitle: string;
  roleBrief: Job;
};

export function JobTalentPoolTab({ jobId, roleBrief }: JobTalentPoolTabProps) {
  const { openPanel, refreshPanel, candidateId: openPanelId } =
    useCandidatePanel();
  const panelOptions = useMemo(
    () => ({ contextJobId: jobId, roleBrief }),
    [jobId, roleBrief],
  );
  const [matches, setMatches] = useState<TalentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [rematchingId, setRematchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/talent-matches`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load matches");
      setMatches(json.matches as TalentMatch[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rematch = async (candidateId: string) => {
    setRematchingId(candidateId);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleBriefId: jobId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Re-match failed");
      await load();
      if (openPanelId === candidateId) refreshPanel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-match failed");
    } finally {
      setRematchingId(null);
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
        Candidates from your talent pool who may fit this role, ranked by local
        signal matching against must-haves and key requirements.
      </p>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {matches.length === 0 ? (
        <div className={`${karta.card} px-6 py-12 text-center text-sm text-[#64748B]`}>
          No talent pool matches yet. Add candidates to your talent pool and score
          them against other roles first.
        </div>
      ) : (
        <ul className="space-y-3">
          {matches.map((m) => (
            <li
              key={m.candidateId}
              className={`flex flex-wrap items-center justify-between gap-4 ${karta.card} p-5`}
            >
              <div>
                <ClickableCandidateName
                  candidateId={m.candidateId}
                  panelOptions={panelOptions}
                  className="font-semibold text-[#1E293B] hover:text-[#0D9488] hover:underline text-left"
                >
                  {m.candidateName}
                </ClickableCandidateName>
                <p className="mt-1 text-sm text-[#64748B]">
                  {m.yearsExperience} yrs · Previously scored: {m.previousRoleTitle}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-lg font-semibold text-[#0D9488]">
                  {m.matchPercent}%
                </span>
                <button
                  type="button"
                  disabled={rematchingId === m.candidateId}
                  onClick={() => void rematch(m.candidateId)}
                  className={karta.btnPrimary}
                >
                  {rematchingId === m.candidateId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Re-match"
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
