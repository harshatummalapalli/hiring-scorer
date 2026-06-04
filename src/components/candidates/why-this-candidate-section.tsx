"use client";

import type { RoleBrief } from "@/types/role-brief";
import type { CandidateScoreResult } from "@/types/score";
import { buildRoleFitSummary } from "@/lib/scoring/role-fit-summary";
import { karta } from "@/lib/brand/karta";

type WhyThisCandidateSectionProps = {
  result: CandidateScoreResult;
  roleBrief: RoleBrief;
  cannotAssessItems?: string[];
};

export function WhyThisCandidateSection({
  result,
  roleBrief,
  cannotAssessItems = [],
}: WhyThisCandidateSectionProps) {
  const card = result.recruiter_card;
  if (!card) return null;

  const hasContent =
    card.what_stands_out.length > 0 ||
    card.worth_exploring.length > 0 ||
    cannotAssessItems.length > 0;

  if (!hasContent) return null;

  return (
    <section className={karta.accentTealSection}>
      <h3 className={karta.sectionHeading}>Why This Candidate</h3>
      <p className="mt-2 text-sm italic text-[#64748B]">
        {buildRoleFitSummary(result, roleBrief)}
      </p>
      {card.what_stands_out.length > 0 && (
        <ul className="mt-3 space-y-3">
          {card.what_stands_out.slice(0, 3).map((item, i) => (
            <li key={i} className="text-sm text-[#334155]">
              <p className="font-medium text-[#0D9488]">Strength</p>
              <p>{item.signal}</p>
              {item.evidence && (
                <blockquote className="mt-1 border-l-2 border-[#0D9488] pl-3 text-xs italic text-[#64748B]">
                  &ldquo;{item.evidence}&rdquo;
                </blockquote>
              )}
            </li>
          ))}
        </ul>
      )}
      {card.worth_exploring.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Watch points
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
            {card.worth_exploring.slice(0, 3).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {cannotAssessItems.length > 0 && (
        <div className="mt-4 border-t border-teal-100 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            Verify in conversation
          </p>
          <ul className="mt-2 space-y-1">
            {cannotAssessItems.map((item, i) => (
              <li
                key={i}
                className="flex items-center gap-2 text-sm text-[#334155]"
              >
                <span className="text-[#0D9488]">◦</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
