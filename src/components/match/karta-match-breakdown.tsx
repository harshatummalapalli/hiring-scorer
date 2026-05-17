"use client";

import { Check, Sparkles, AlertTriangle } from "lucide-react";
import type { RoleBrief } from "@/types/role-brief";
import type { CandidateScoreResult, DimensionKey } from "@/types/score";
import { DIMENSION_LABELS } from "@/types/score";
import { karta } from "@/lib/brand/karta";

const DIMENSION_KEYS: DimensionKey[] = [
  "skills",
  "trajectory",
  "domain",
  "seniority",
  "tenure",
];

type KartaMatchBreakdownProps = {
  result: CandidateScoreResult;
  roleBrief: RoleBrief;
};

export function KartaMatchBreakdown({
  result,
  roleBrief,
}: KartaMatchBreakdownProps) {
  const intel = result.skills_intelligence;

  return (
    <div className="mt-4 space-y-6 border-t border-[#F1F5F9] pt-4">
      {intel && (
        <section>
          <h3 className={karta.sectionHeading}>Skills Match</h3>
          <ul className="mt-3 space-y-2">
            {intel.matches.map((m) => (
              <li
                key={m.skill}
                className="flex items-start gap-2 text-sm text-[#334155]"
              >
                {m.match_type === "direct" && (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" />
                )}
                {m.match_type === "semantic" && (
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                )}
                {m.match_type === "not_found" && (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                )}
                <span>
                  <span className="font-medium">{m.skill}</span>
                  {m.match_type === "semantic" && m.matched_term && (
                    <span className="text-[#64748B]">
                      {" "}
                      — via {m.matched_term}
                    </span>
                  )}
                  {m.match_type === "not_found" && (
                    <span className="text-[#64748B]"> — not found</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className={karta.sectionHeading}>Score Breakdown</h3>
        <div className="mt-3 space-y-3">
          {DIMENSION_KEYS.map((key) => {
            const dim = result.dimension_scores[key];
            const score = dim?.score ?? 0;
            const weight = {
              skills: roleBrief.weight_skills,
              trajectory: roleBrief.weight_trajectory,
              domain: roleBrief.weight_domain,
              seniority: roleBrief.weight_seniority,
              tenure: roleBrief.weight_tenure,
            }[key];
            return (
              <div key={key}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
                  <span className="min-w-0 font-medium text-[#334155]">
                    {DIMENSION_LABELS[key]}
                    <span className="ml-1.5 font-normal text-[#64748B]">
                      (weight {weight}/10)
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-[#1E293B]">
                    {Math.round(score)}
                  </span>
                </div>
                <div className={karta.barTrack}>
                  <div
                    className={karta.barFill}
                    style={{ width: `${Math.min(100, score)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
