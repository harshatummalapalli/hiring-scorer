"use client";

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

type ScoreBreakdownSectionProps = {
  result: CandidateScoreResult;
  roleBrief: RoleBrief;
};

export function ScoreBreakdownSection({
  result,
  roleBrief,
}: ScoreBreakdownSectionProps) {
  return (
    <section className={`${karta.card} p-4`}>
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
  );
}
