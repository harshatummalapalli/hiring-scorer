"use client";

import { useState } from "react";
import type { RoleBrief } from "@/types/role-brief";
import type { CandidateScoreResult } from "@/types/score";
import { buildRoleFitSummary } from "@/lib/scoring/role-fit-summary";
import { karta } from "@/lib/brand/karta";

type WhyThisCandidateSectionProps = {
  result: CandidateScoreResult;
  roleBrief: RoleBrief;
  cannotAssessItems?: string[];
  variant?: "default" | "overview";
};

export function WhyThisCandidateSection({
  result,
  roleBrief,
  cannotAssessItems = [],
  variant = "default",
}: WhyThisCandidateSectionProps) {
  const card = result.recruiter_card;
  const [watchExpanded, setWatchExpanded] = useState(false);

  if (!card) return null;

  const summary = buildRoleFitSummary(result, roleBrief);
  const verifyItems = cannotAssessItems.slice(0, 5);
  const watchPoints = card.worth_exploring;
  const visibleWatch = watchExpanded ? watchPoints : watchPoints.slice(0, 3);

  const hasContent =
    summary.trim().length > 0 ||
    card.what_stands_out.length > 0 ||
    watchPoints.length > 0 ||
    verifyItems.length > 0;

  if (!hasContent) return null;

  if (variant === "overview") {
    const headingClass = `${karta.sectionHeading} section-heading-accent`;

    return (
      <div className="space-y-3">
        {summary.trim().length > 0 && (
          <section className="rounded-lg border-l-[3px] border-teal-400 bg-gradient-to-r from-teal-50/50 to-transparent p-4">
            <h3 className={headingClass}>Why This Candidate</h3>
            <p className="mt-1.5 text-[14px] italic text-slate-700">{summary}</p>
          </section>
        )}

        {card.what_stands_out.length > 0 && (
          <section className="rounded-lg border border-[#E2E8F0] border-l-[3px] border-l-emerald-500 bg-white px-3 py-2.5">
            <h3 className={headingClass}>Strengths</h3>
            <ul className="mt-2 space-y-2.5">
              {card.what_stands_out.map((item, i) => (
                <li key={i} className="text-sm text-[#334155]">
                  <p className="font-medium text-[#1E293B]">{item.signal}</p>
                  {item.evidence && (
                    <blockquote className="mt-1 border-l-2 border-emerald-300 pl-2.5 text-xs italic text-[#64748B]">
                      &ldquo;{item.evidence}&rdquo;
                    </blockquote>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {watchPoints.length > 0 && (
          <section className="rounded-lg border-l-[3px] border-amber-400 bg-gradient-to-r from-amber-50/50 to-transparent p-4">
            <h3 className={headingClass}>Watch Points</h3>
            <ul className="mt-2 space-y-1 text-sm text-amber-900">
              {visibleWatch.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
            {watchPoints.length > 3 && (
              <button
                type="button"
                onClick={() => setWatchExpanded((v) => !v)}
                className="mt-2 text-xs font-medium text-[#0D9488] hover:text-[#0B8276]"
              >
                {watchExpanded ? "Show less" : "Show more"}
              </button>
            )}
          </section>
        )}

        {verifyItems.length > 0 && (
          <section className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5">
            <h3 className={headingClass}>Verify in Conversation</h3>
            <ul className="mt-2 space-y-1">
              {verifyItems.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-[#334155]"
                >
                  <span className="mt-0.5 text-[#0D9488]">◦</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  return (
    <section className={karta.accentTealSection}>
      <h3 className={karta.sectionHeading}>Why This Candidate</h3>
      <p className="mt-2 text-sm italic text-[#64748B]">{summary}</p>
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
      {watchPoints.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Watch points
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
            {watchPoints.slice(0, 3).map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {verifyItems.length > 0 && (
        <div className="mt-4 border-t border-teal-100 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            Verify in conversation
          </p>
          <ul className="mt-2 space-y-1">
            {verifyItems.map((item, i) => (
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
