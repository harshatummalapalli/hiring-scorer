"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { ClickableCandidateName } from "@/components/candidates/clickable-candidate-name";
import type { OpenCandidatePanelOptions } from "@/contexts/candidate-panel-context";
import {
  sanitizeDisplayCompany,
  sanitizeDisplayTitle,
} from "@/lib/candidates/candidate-identity-display";
import type { EducationEntry } from "@/types/candidate";

// ─── Helpers (duplicated from candidate-panel-header to keep
//     components self-contained) ──────────────────────────────

const DEGREE_RANK: Record<string, number> = {
  phd: 4,
  doctorate: 4,
  mba: 3,
  masters: 3,
  master: 3,
  msc: 3,
  "m.sc": 3,
  "m.tech": 3,
  bachelors: 2,
  bachelor: 2,
  bsc: 2,
  "b.sc": 2,
  "b.tech": 2,
  be: 2,
  bca: 2,
  bba: 2,
  diploma: 1,
};

function degreeRank(degree: string | null): number {
  if (!degree) return 0;
  const key = degree.toLowerCase().trim();
  for (const [p, r] of Object.entries(DEGREE_RANK)) {
    if (key.includes(p)) return r;
  }
  return 1;
}

function resolveGradYear(education: EducationEntry[]): number | null {
  if (!education?.length) return null;
  let best: EducationEntry | null = null;
  let bestRank = 0;
  for (const ed of education) {
    const rank = degreeRank(ed.degree);
    if (
      rank > bestRank ||
      (rank === bestRank &&
        ed.year &&
        best?.year &&
        Number(ed.year) > Number(best.year))
    ) {
      bestRank = rank;
      best = ed;
    }
  }
  if (!best?.year) return null;
  const y = parseInt(best.year, 10);
  return isNaN(y) || y < 1970 || y > new Date().getFullYear() ? null : y;
}

function calcVerifiedExperience(
  education: EducationEntry[],
  careerGapMonths: number,
  claimedTotal: string | null,
): { display: string; isCalculated: boolean } {
  const gradYear = resolveGradYear(education);
  if (!gradYear) {
    return { display: claimedTotal ?? "", isCalculated: false };
  }
  const startDate = new Date(gradYear, 5, 1);
  const now = new Date();
  const totalMonths =
    (now.getFullYear() - startDate.getFullYear()) * 12 +
    (now.getMonth() - startDate.getMonth());
  const netMonths = Math.max(0, totalMonths - careerGapMonths);
  const years = Math.floor(netMonths / 12);
  const months = netMonths % 12;
  let display = "";
  if (years > 0 && months > 0) display = `${years} yr ${months} mo`;
  else if (years > 0) display = `${years} years`;
  else display = `${months} months`;
  return { display, isCalculated: true };
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function SkillsRow({ skills }: { skills: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!skills.length) return null;
  const top5 = skills.slice(0, 5);
  const rest = skills.slice(5);
  return (
    <div className="relative mt-1.5 flex flex-wrap items-center gap-1">
      {top5.map((s, i) => (
        <span
          key={i}
          className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px]
            font-medium text-[#0D9488]"
        >
          {s}
        </span>
      ))}
      {rest.length > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="rounded-full border border-slate-200 bg-white px-2 py-0.5
            text-[11px] font-medium text-[#64748B] hover:bg-slate-50"
        >
          +{rest.length}
        </button>
      )}
      {expanded && (
        <div
          className="absolute left-0 top-7 z-20 flex max-w-xs flex-wrap
          gap-1 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
        >
          {rest.map((s, i) => (
            <span
              key={i}
              className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px]
                font-medium text-[#0D9488]"
            >
              {s}
            </span>
          ))}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(false);
            }}
            className="mt-1 w-full text-center text-[11px] text-[#94A3B8]"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────

export type CandidateIdentityCardProps = {
  displayName: string;
  candidateId?: string;
  panelOptions?: OpenCandidatePanelOptions;
  currentTitle?: string | null;
  currentCompany?: string | null;
  yearsExperience?: string | null;
  experienceYears?: number | null;
  location?: string | null;
  topSkills?: string[] | null;
  education?: EducationEntry[] | null;
  careerGaps?: Array<{ months: number }> | null;
  scoredJobTitle?: string | null;
  verdictBadge?: ReactNode;
  showMetaRow?: boolean;
  enforceMinHeight?: boolean;
  showExperienceWhenNoTitle?: boolean;
  /** When true renders inline (no avatar) — for compact table rows */
  compact?: boolean;
};

export function CandidateIdentityCard({
  displayName,
  candidateId,
  panelOptions,
  currentTitle,
  currentCompany,
  yearsExperience,
  topSkills,
  education,
  careerGaps,
  scoredJobTitle,
  verdictBadge,
  compact = false,
}: CandidateIdentityCardProps) {
  const title = sanitizeDisplayTitle(currentTitle, {
    roleBriefTitle: scoredJobTitle,
  });
  const company = sanitizeDisplayCompany(currentCompany);

  const roleLine =
    title && company
      ? `${title}  ·  ${company}`
      : title
        ? title
        : company
          ? company
          : null;

  // Experience
  const gapMonths = (careerGaps ?? []).reduce(
    (s, g) => s + (g.months ?? 0),
    0,
  );
  const { display: expDisplay, isCalculated } = calcVerifiedExperience(
    education ?? [],
    gapMonths,
    yearsExperience ?? null,
  );

  // Skills — already density-ordered by Gemini
  const allSkills = (topSkills ?? []).filter(Boolean);

  // Education — highest degree
  const topEd = (education ?? []).reduce(
    (best: EducationEntry | null, ed) =>
      degreeRank(ed.degree) >= degreeRank(best?.degree ?? null) ? ed : best,
    null,
  );

  const initials = initialsFromName(displayName);

  const nameEl = candidateId ? (
    <ClickableCandidateName
      candidateId={candidateId}
      panelOptions={panelOptions}
    >
      {displayName}
    </ClickableCandidateName>
  ) : (
    <span>{displayName}</span>
  );

  // ── Compact mode (table rows, shortlist) — no avatar ─────────
  if (compact) {
    return (
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-[15px] font-semibold leading-snug text-[#1E293B]">
            {nameEl}
          </p>
          {verdictBadge}
        </div>
        {roleLine && (
          <p className="mt-0.5 truncate text-[13px] text-[#334155]">
            {roleLine}
          </p>
        )}
        {expDisplay && (
          <p className="mt-0.5 text-[12px] font-semibold text-[#0D9488]">
            {expDisplay}
            <span className="ml-1 font-normal text-[#94A3B8]">
              {isCalculated ? "verified" : "claimed"}
            </span>
          </p>
        )}
        <SkillsRow skills={allSkills} />
        {topEd && (
          <p className="mt-1 text-[11px] text-[#94A3B8]">
            {[topEd.degree, topEd.institution, topEd.year]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>
    );
  }

  // ── Full mode (pipeline rows, talent pool) — with avatar ─────
  return (
    <div className="flex min-w-0 gap-3">
      {/* Initials avatar */}
      <div className="shrink-0">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full
          bg-[#0D9488]/15 text-sm font-bold text-[#0D9488] select-none"
        >
          {initials}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-[15px] font-semibold leading-snug text-[#1E293B]">
            {nameEl}
          </p>
          {verdictBadge}
        </div>
        {expDisplay && (
          <p className="mt-0.5 text-[12px] font-semibold text-[#0D9488]">
            {expDisplay}
            <span className="ml-1 font-normal text-[#94A3B8]">
              {isCalculated ? "verified" : "claimed"}
            </span>
          </p>
        )}
        {roleLine && (
          <p className="mt-0.5 truncate text-[13px] text-[#334155]">
            {roleLine}
          </p>
        )}
        <SkillsRow skills={allSkills} />
        {topEd && (
          <p className="mt-1 text-[11px] text-[#94A3B8]">
            {[topEd.degree, topEd.institution, topEd.year]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}
