"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles, Users } from "lucide-react";
import { useCandidatePanel } from "@/contexts/candidate-panel-context";
import { karta } from "@/lib/brand/karta";

type TalentMatch = {
  candidateId: string;
  candidateName: string;
  yearsExperience: string;
  matchPercent: number;
  matchedSkills: string[];
  seniorityNote: string | null;
  previousRoleTitle: string;
  previousScore: number | null;
};

type TalentMatchesResponse = {
  matches: TalentMatch[];
  poolTotal: number;
  strongMatches: number;
};

type TalentRediscoveryBannerProps = {
  jobId: string;
};

export function TalentRediscoveryBanner({ jobId }: TalentRediscoveryBannerProps) {
  const { openPanel } = useCandidatePanel();
  const [data, setData] = useState<TalentMatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/talent-matches`);
      const json = (await res.json()) as TalentMatchesResponse & {
        error?: string;
      };
      if (res.ok) setData(json);
    } catch {
      /* non-blocking */
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (dismissed || loading) {
    if (loading) {
      return (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200/60 bg-white px-4 py-3 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching talent pool for matches…
        </div>
      );
    }
    return null;
  }

  if (!data || data.poolTotal === 0) return null;

  const topMatches = data.matches.slice(0, 5);
  if (topMatches.length === 0) return null;

  return (
    <section className={`${karta.accentTealSection} space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1E293B]">
              Talent rediscovery
            </h2>
            <p className="mt-1 text-sm text-[#64748B]">
              Kharta found{" "}
              <span className="font-semibold text-[#1E293B]">
                {data.poolTotal}
              </span>{" "}
              candidates in your pool who may fit this role
              {data.strongMatches > 0 && (
                <>
                  {" "}
                  —{" "}
                  <span className="font-semibold text-teal-700">
                    {data.strongMatches} strong matches
                  </span>{" "}
                  before uploading new resumes
                </>
              )}
              .
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-xs font-medium text-[#64748B] hover:text-[#1E293B]"
        >
          Dismiss
        </button>
      </div>

      <ul className="divide-y divide-teal-100/80 rounded-lg border border-teal-100 bg-white/80">
        {topMatches.map((m) => (
          <li
            key={m.candidateId}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <button
                type="button"
                onClick={() =>
                  openPanel(m.candidateId, { contextJobId: jobId })
                }
                className="text-left text-sm font-semibold text-[#1E293B] hover:text-teal-700"
              >
                {m.candidateName}
              </button>
              <p className="mt-0.5 text-xs text-[#64748B]">
                {m.yearsExperience || "Experience unknown"}
                {m.previousScore != null && (
                  <> · Last scored {m.previousScore} for {m.previousRoleTitle}</>
                )}
              </p>
              {m.matchedSkills.length > 0 && (
                <p className="mt-1 text-xs text-teal-800">
                  {m.matchedSkills.slice(0, 4).join(", ")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-800">
                {m.matchPercent}% fit
              </span>
              <button
                type="button"
                onClick={() =>
                  openPanel(m.candidateId, { contextJobId: jobId })
                }
                className="text-xs font-semibold text-teal-700 hover:underline"
              >
                Evaluate
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link
          href="/talent-pool"
          className="inline-flex items-center gap-1.5 font-semibold text-teal-700 hover:underline"
        >
          <Users className="h-4 w-4" />
          Open talent pool
        </Link>
      </div>
    </section>
  );
}
