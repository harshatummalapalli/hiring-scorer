"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { CandidateIdentityCard } from "@/components/candidates/candidate-identity-card";
import { topSkillsForDisplay } from "@/lib/candidates/candidate-identity-display";
import { karta } from "@/lib/brand/karta";
import { fetchCandidatesForRecommendations } from "@/lib/recommendations/fetch-candidates-for-recommendations";
import type { RecommendationCandidateInput } from "@/lib/recommendations/local-recommendation";
import {
  countRecommendationsAbove,
  scoreAllTalentRecommendations,
  type TalentRecommendation,
} from "@/lib/recommendations/local-recommendation";
import { getErrorMessage } from "@/lib/errors";
import type { RoleBrief } from "@/types/role-brief";

type TalentPoolRecommendationsProps = {
  roleBrief: RoleBrief;
  refreshToken?: number;
};

export function TalentPoolRecommendations({
  roleBrief,
  refreshToken = 0,
}: TalentPoolRecommendationsProps) {
  const [topFive, setTopFive] = useState<TalentRecommendation[]>([]);
  const [candidateById, setCandidateById] = useState<
    Map<string, RecommendationCandidateInput>
  >(new Map());
  const [aboveThreshold, setAboveThreshold] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rematchingId, setRematchingId] = useState<string | null>(null);

  const panelOptions = useMemo(
    () => ({ contextJobId: roleBrief.id, roleBrief }),
    [roleBrief],
  );

  const runRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const candidates = await fetchCandidatesForRecommendations();
      setCandidateById(new Map(candidates.map((c) => [c.id, c])));
      const start = performance.now();
      const allScored = scoreAllTalentRecommendations(roleBrief, candidates);
      const elapsed = performance.now() - start;
      if (elapsed > 500 && candidates.length > 0) {
        console.warn(
          `[Kharta] Local recommendations took ${Math.round(elapsed)}ms for ${candidates.length} candidates`,
        );
      }
      setTopFive(allScored.slice(0, 5));
      setAboveThreshold(countRecommendationsAbove(allScored, 30));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load recommendations"));
      setTopFive([]);
      setAboveThreshold(0);
    } finally {
      setLoading(false);
    }
  }, [roleBrief]);

  useEffect(() => {
    void runRecommendations();
  }, [runRecommendations, refreshToken]);

  const handleRematch = async (candidateId: string) => {
    setRematchingId(candidateId);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleBriefId: roleBrief.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Re-match failed");
    } catch (err) {
      setError(getErrorMessage(err, "Re-match failed"));
    } finally {
      setRematchingId(null);
    }
  };

  return (
    <section className={`${karta.card} mt-4 p-5`}>
      <h3 className="text-base font-semibold text-[#1E293B]">
        Recommended from your talent pool
      </h3>
      <p className="mt-1 text-sm text-[#64748B]">
        These recommendations are based on stored profiles — use Re-match for a
        full AI assessment.
      </p>

      {error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-[#64748B]">
          <Loader2 className="h-5 w-5 animate-spin text-[#0D9488]" />
          <span className="text-sm">Finding recommendations…</span>
        </div>
      ) : topFive.length === 0 ? (
        <p className="mt-4 text-sm text-[#64748B]">
          Upload more candidates to see recommendations.
        </p>
      ) : (
        <>
          {aboveThreshold < 3 && (
            <p className="mt-3 text-sm text-amber-800">
              Upload more candidates to see recommendations.
            </p>
          )}
          <ul className="mt-4 space-y-2">
            {topFive.map((rec) => (
              <li
                key={rec.candidateId}
                className="flex flex-col gap-2 rounded-md border border-[#F1F5F9] bg-[#F8FAFC] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <CandidateIdentityCard
                    displayName={rec.candidateName}
                    candidateId={rec.candidateId}
                    panelOptions={panelOptions}
                    currentTitle={
                      candidateById.get(rec.candidateId)?.signal_profile
                        .current_title
                    }
                    currentCompany={
                      candidateById.get(rec.candidateId)?.signal_profile
                        .current_company
                    }
                    yearsExperience={
                      candidateById.get(rec.candidateId)?.signal_profile
                        .total_years_experience
                    }
                    experienceYears={
                      candidateById.get(rec.candidateId)?.signal_profile
                        .experience_years
                    }
                    location={
                      candidateById.get(rec.candidateId)?.signal_profile.location
                    }
                    topSkills={topSkillsForDisplay(
                      rec.matchedSkills,
                      candidateById.get(rec.candidateId)?.signal_profile
                        .skills_verified,
                      candidateById.get(rec.candidateId)?.signal_profile
                        .skills_listed_only,
                      5,
                    )}
                    scoredJobTitle={roleBrief.title}
                  />
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums text-[#0D9488]">
                    {rec.score}%
                  </span>
                  <button
                    type="button"
                    disabled={rematchingId !== null}
                    onClick={() => void handleRematch(rec.candidateId)}
                    className={`inline-flex items-center gap-1 ${karta.btnOutlineTeal} px-2.5 py-1 text-xs`}
                  >
                    {rematchingId === rec.candidateId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    Re-match
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
