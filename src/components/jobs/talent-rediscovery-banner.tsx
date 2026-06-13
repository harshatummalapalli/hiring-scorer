"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { LocalMatchResult } from "@/lib/intelligence/local-talent-match";
import { karta } from "@/lib/brand/karta";
import { useToast } from "@/components/ui/toast";

type TalentMatchesResponse = {
  matches: LocalMatchResult[];
  totalPoolSize: number;
};

type TalentRediscoveryBannerProps = {
  jobId: string;
};

const CACHE_DURATION_MS = 5 * 60 * 1000;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function signalQualityLabel(quality: LocalMatchResult["signalQuality"]): string {
  switch (quality) {
    case "high":
      return "◆ High";
    case "low":
      return "○ Low";
    default:
      return "◇ Medium";
  }
}

function signalQualityColor(quality: LocalMatchResult["signalQuality"]): string {
  switch (quality) {
    case "high":
      return "#1D9E75";
    case "low":
      return "var(--color-text-secondary, #64748B)";
    default:
      return "#BA7517";
  }
}

export function TalentRediscoveryBanner({ jobId }: TalentRediscoveryBannerProps) {
  const { toast } = useToast();
  const [talentMatches, setTalentMatches] = useState<LocalMatchResult[]>([]);
  const [checkingMatches, setCheckingMatches] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [pipelineExpandedDefaultSet, setPipelineExpandedDefaultSet] =
    useState(false);
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const matchesFetchedAtRef = useRef<number | null>(null);

  const fetchTalentMatches = useCallback(async () => {
    if (
      matchesFetchedAtRef.current &&
      Date.now() - matchesFetchedAtRef.current < CACHE_DURATION_MS
    ) {
      setCheckingMatches(false);
      return;
    }

    setCheckingMatches(true);
    try {
      const [matchRes, pipelineRes] = await Promise.all([
        fetch(`/api/jobs/${jobId}/talent-matches`),
        fetch(`/api/jobs/${jobId}/candidates`),
      ]);

      const matchJson = (await matchRes.json()) as TalentMatchesResponse & {
        error?: string;
      };
      if (matchRes.ok) {
        setTalentMatches(matchJson.matches ?? []);
        matchesFetchedAtRef.current = Date.now();
      }

      if (pipelineRes.ok && !pipelineExpandedDefaultSet) {
        const pipelineJson = (await pipelineRes.json()) as {
          candidates?: unknown[];
        };
        const count = pipelineJson.candidates?.length ?? 0;
        setExpanded(count === 0);
        setPipelineExpandedDefaultSet(true);
      }
    } catch {
      /* non-blocking */
    } finally {
      setCheckingMatches(false);
    }
  }, [jobId, pipelineExpandedDefaultSet]);

  useEffect(() => {
    void fetchTalentMatches();
  }, [fetchTalentMatches, jobId]);

  const evaluateMatch = async (match: LocalMatchResult) => {
    setEvaluatingId(match.candidateId);
    try {
      const res = await fetch(`/api/candidates/${match.candidateId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleBriefId: jobId }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to evaluate candidate");
      }

      setTalentMatches((prev) =>
        prev.filter((m) => m.candidateId !== match.candidateId),
      );
      window.dispatchEvent(
        new CustomEvent("karta:job-scores-recomputed", {
          detail: { jobId },
        }),
      );
      toast("Added to pipeline — evaluating now");
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Failed to evaluate candidate",
        "error",
      );
    } finally {
      setEvaluatingId(null);
    }
  };

  if (checkingMatches) {
    return (
      <p className="mb-4 text-sm text-[#64748B]">Checking talent pool...</p>
    );
  }

  if (talentMatches.length === 0) {
    return null;
  }

  const matchLabel =
    talentMatches.length === 1
      ? "1 candidate in your Talent Pool may fit this role"
      : `${talentMatches.length} candidates in your Talent Pool may fit this role`;

  return (
    <section className={`mb-4 ${karta.card} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/80"
      >
        <div>
          <p className="text-sm font-semibold text-[#1E293B]">✦ {matchLabel}</p>
          <p className="mt-0.5 text-xs text-[#64748B]">
            Local match — not yet evaluated against this JD
          </p>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-[#64748B]" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-[#64748B]" />
        )}
      </button>

      {expanded && (
        <ul className="divide-y divide-[#F1F5F9] border-t border-[#F1F5F9]">
          {talentMatches.map((match) => {
            const titleLine = [match.currentTitle, match.currentCompany]
              .filter(Boolean)
              .join(" · ");
            const yearsLabel =
              match.totalYearsExperience != null
                ? `${match.totalYearsExperience} yrs`
                : null;
            const skillsLabel = match.skillOverlap.slice(0, 3).join(", ");
            const metaParts = [yearsLabel, skillsLabel].filter(Boolean);
            const mustHaveLabel =
              match.mustHaveTotal > 0
                ? `${match.mustHaveHits.length} of ${match.mustHaveTotal} must-haves`
                : "No must-haves defined";
            const isEvaluating = evaluatingId === match.candidateId;

            return (
              <li
                key={match.candidateId}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-xs font-semibold text-teal-700"
                  aria-hidden
                >
                  {initials(match.displayName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#1E293B]">
                    {match.displayName}
                  </p>
                  {titleLine && (
                    <p className="truncate text-xs text-[#64748B]">{titleLine}</p>
                  )}
                  {metaParts.length > 0 && (
                    <p className="mt-0.5 truncate text-xs text-[#64748B]">
                      {metaParts.join(" · ")}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-[#64748B]">
                    Local match:{" "}
                    <span className="font-semibold text-[#1E293B]">
                      {match.localScore}
                    </span>
                    {" · "}
                    {mustHaveLabel}
                    {" · "}
                    <span style={{ color: signalQualityColor(match.signalQuality) }}>
                      {signalQualityLabel(match.signalQuality)}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isEvaluating}
                  onClick={() => void evaluateMatch(match)}
                  className={`${karta.btnOutlineTeal} shrink-0 px-3 py-1.5 text-sm disabled:opacity-50`}
                >
                  {isEvaluating ? "Adding..." : "→ Evaluate"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
