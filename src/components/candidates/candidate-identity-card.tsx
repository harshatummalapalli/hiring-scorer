"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { ClickableCandidateName } from "@/components/candidates/clickable-candidate-name";
import { SkillPill } from "@/components/ui/skill-pill";
import type { OpenCandidatePanelOptions } from "@/contexts/candidate-panel-context";
import {
  resolveDisplayRole,
  sanitizeProfessionalSummaryForDisplay,
  topSkillsForDisplay,
} from "@/lib/candidates/candidate-identity-display";
import { estimateYearsExperience } from "@/lib/candidates/parse-resume-structure";
import type { EducationEntry, ExperienceEntry } from "@/types/candidate";
import type { FitVerdict } from "@/types/score";

function verdictAvatarClass(verdict?: FitVerdict | null): string {
  switch (verdict) {
    case "EXCEPTIONAL MATCH":
      return "bg-violet-100 text-violet-700";
    case "STRONG MATCH":
      return "bg-emerald-100 text-emerald-700";
    case "POTENTIAL MATCH":
      return "bg-amber-100 text-amber-700";
    case "WEAK MATCH":
      return "bg-orange-100 text-orange-700";
    case "NOT A MATCH":
      return "bg-red-100 text-red-600";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

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

function isMissingExperience(display: string): boolean {
  const trimmed = display.trim();
  return !trimmed || /^not\s+stated$/i.test(trimmed);
}

function SkillsRow({ skills }: { skills: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!skills.length) return null;
  const top5 = skills.slice(0, 5);
  const rest = skills.slice(5);
  return (
    <div className="relative mt-1.5 flex flex-wrap items-center gap-1">
      {top5.map((s, i) => (
        <SkillPill key={i} skill={s} />
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
            <SkillPill key={i} skill={s} />
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
  skillsVerified?: Array<{ skill: string } | string> | null;
  professionalSummary?: string | null;
  education?: EducationEntry[] | null;
  experience?: ExperienceEntry[] | null;
  careerGaps?: Array<{ months: number }> | null;
  scoredJobTitle?: string | null;
  verdict?: FitVerdict | null;
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
  skillsVerified,
  professionalSummary,
  education,
  experience,
  careerGaps,
  scoredJobTitle,
  verdict = null,
  verdictBadge,
  compact = false,
}: CandidateIdentityCardProps) {
  const { title, company } = resolveDisplayRole({
    currentTitle,
    currentCompany,
    experience: experience ?? [],
    roleBriefTitle: scoredJobTitle,
  });

  const roleLine =
    title && company
      ? `${title}  ·  ${company}`
      : title
        ? title
        : company
          ? company
          : null;

  const cleanedSummary = sanitizeProfessionalSummaryForDisplay(
    professionalSummary,
  );
  const summaryLine =
    !roleLine && cleanedSummary && cleanedSummary.length <= 140
      ? cleanedSummary
      : null;

  const subtitleLine = roleLine ?? summaryLine;

  const gapMonths = (careerGaps ?? []).reduce(
    (s, g) => s + (g.months ?? 0),
    0,
  );
  let claimedYears = yearsExperience ?? null;
  if (isMissingExperience(claimedYears ?? "") && (experience?.length ?? 0) > 0) {
    const estimated = estimateYearsExperience(experience ?? []);
    if (!isMissingExperience(estimated)) claimedYears = estimated;
  }
  const { display: expDisplay, isCalculated } = calcVerifiedExperience(
    education ?? [],
    gapMonths,
    claimedYears,
  );

  const verifiedSkills = (skillsVerified ?? []).map((s) =>
    typeof s === "string" ? { skill: s } : s,
  );
  const allSkills = topSkillsForDisplay(
    topSkills,
    verifiedSkills,
    undefined,
    5,
  );

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
        {subtitleLine && (
          <p className="mt-0.5 truncate text-[13px] text-[#334155]">
            {subtitleLine}
          </p>
        )}
        {expDisplay && !isMissingExperience(expDisplay) && (
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
          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold select-none ${verdictAvatarClass(verdict)}`}
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
        {expDisplay && !isMissingExperience(expDisplay) && (
          <p className="mt-0.5 text-[12px] font-semibold text-[#0D9488]">
            {expDisplay}
            <span className="ml-1 font-normal text-[#94A3B8]">
              {isCalculated ? "verified" : "claimed"}
            </span>
          </p>
        )}
        {subtitleLine && (
          <p className="mt-0.5 truncate text-[13px] text-[#334155]">
            {subtitleLine}
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
