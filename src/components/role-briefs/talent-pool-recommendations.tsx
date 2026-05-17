"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { karta } from "@/lib/brand/karta";
import { fetchCandidatesForRecommendations } from "@/lib/recommendations/fetch-candidates-for-recommendations";
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
  const [aboveThreshold, setAboveThreshold] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rematchingId, setRematchingId] = useState<string | null>(null);

  const runRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const candidates = await fetchCandidatesForRecommendations();
      const start = performance.now();
      const allScored = scoreAllTalentRecommendations(roleBrief, candidates);
      const elapsed = performance.now() - start;
      if (elapsed > 500 && candidates.length > 0) {
        console.warn(
          `[Karta] Local recommendations took ${Math.round(elapsed)}ms for ${candidates.length} candidates`,
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
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/talent-pool?open=${encodeURIComponent(rec.candidateId)}`}
                      className="font-medium text-[#1E293B] hover:text-[#0D9488] hover:underline"
                    >
                      {rec.candidateName}
                    </Link>
                    <span className="text-xs text-[#64748B]">
                      {rec.yearsExperience === "0" ||
                      rec.yearsExperience === "—"
                        ? "—"
                        : `${rec.yearsExperience} yrs`}
                    </span>
                  </div>
                  {rec.matchedSkills.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {rec.matchedSkills.slice(0, 2).map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex rounded-full border border-[#0D9488]/40 bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-[#0D9488]"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
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
