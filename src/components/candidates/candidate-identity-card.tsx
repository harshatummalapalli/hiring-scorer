"use client";

import type { ReactNode } from "react";
import { ClickableCandidateName } from "@/components/candidates/clickable-candidate-name";
import type { OpenCandidatePanelOptions } from "@/contexts/candidate-panel-context";
import {
  formatIdentityExperienceYears,
  sanitizeDisplayCompany,
  sanitizeDisplayTitle,
  topSkillsForDisplay,
} from "@/lib/candidates/candidate-identity-display";

export type CandidateIdentityCardProps = {
  displayName: string;
  candidateId?: string;
  panelOptions?: OpenCandidatePanelOptions;
  currentTitle?: string | null;
  currentCompany?: string | null;
  experienceYears?: number | null;
  yearsExperience?: string | null;
  location?: string | null;
  topSkills?: string[] | null;
  sourceLabel?: string;
  scoredJobTitle?: string | null;
  verdictBadge?: ReactNode;
  /** When true, show experience on the subtitle row if title/company are missing. */
  showExperienceWhenNoTitle?: boolean;
  /** Hide the experience/location meta row (e.g. when a table has its own Experience column). */
  showMetaRow?: boolean;
  /** Reserve consistent role/meta rows for list alignment. */
  enforceMinHeight?: boolean;
};

export function CandidateIdentityCard({
  displayName,
  candidateId,
  panelOptions,
  currentTitle,
  currentCompany,
  experienceYears,
  yearsExperience,
  location,
  topSkills,
  sourceLabel,
  scoredJobTitle,
  verdictBadge,
  showExperienceWhenNoTitle = false,
  showMetaRow = true,
  enforceMinHeight = false,
}: CandidateIdentityCardProps) {
  const title = sanitizeDisplayTitle(currentTitle, {
    roleBriefTitle: scoredJobTitle,
  });
  const company = sanitizeDisplayCompany(currentCompany);

  const roleLine =
    title && company
      ? `${title} at ${company}`
      : title
        ? title
        : company
          ? company
          : null;

  const yearsLabel = formatIdentityExperienceYears(
    yearsExperience,
    experienceYears,
  );
  const loc = location?.trim() || null;

  const metaParts: string[] = [];
  if (showMetaRow) {
    if (yearsLabel) metaParts.push(yearsLabel);
    if (loc) metaParts.push(loc);
  }

  const subtitleWhenNoRole =
    showExperienceWhenNoTitle && !roleLine && yearsLabel ? yearsLabel : null;

  const skills = topSkillsForDisplay(topSkills);

  const nameEl = candidateId ? (
    <ClickableCandidateName candidateId={candidateId} panelOptions={panelOptions}>
      {displayName}
    </ClickableCandidateName>
  ) : (
    <span>{displayName}</span>
  );

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[15px] font-semibold leading-snug text-[#1E293B]">
          {nameEl}
        </p>
        {sourceLabel ? (
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
            {sourceLabel}
          </span>
        ) : null}
        {verdictBadge}
      </div>
      {roleLine ? (
        <p className="mt-0.5 truncate text-[13px] leading-snug text-[#334155]">
          {roleLine}
        </p>
      ) : enforceMinHeight ? (
        <p className="mt-0.5 text-[13px] italic text-[#94A3B8]">Title not stated</p>
      ) : subtitleWhenNoRole ? (
        <p className="mt-0.5 text-[12px] text-[#64748B]">{subtitleWhenNoRole}</p>
      ) : null}
      {showMetaRow &&
        (metaParts.length > 0 ? (
          <p className="mt-0.5 text-[12px] text-[#64748B]">
            {metaParts.join(" · ")}
          </p>
        ) : enforceMinHeight ? (
          <p className="mt-0.5 text-[12px] text-[#64748B]">&nbsp;</p>
        ) : null)}
      {skills.length > 0 ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex rounded-full border border-[#0D9488] bg-[#F0FDFA] px-2 py-0.5 text-[11px] font-medium text-[#0D9488]"
            >
              {skill}
            </span>
          ))}
        </div>
      ) : null}
      {scoredJobTitle ? (
        <span className="mt-1.5 inline-flex rounded-full bg-[#0D9488]/10 px-2 py-0.5 text-[11px] font-medium text-[#0D9488]">
          {scoredJobTitle}
        </span>
      ) : null}
    </div>
  );
}
