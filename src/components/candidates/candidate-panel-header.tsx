"use client";

import { useState } from "react";
import { sanitizeDisplayTitle } from "@/lib/candidates/candidate-identity-display";
import { initialsFromName } from "@/lib/candidates/list-filters";
import {
  resolvePanelDisplayName,
  resolvePanelLinkedInUrl,
} from "@/lib/candidates/extract-resume-fields";
import type { CandidateDetail, EducationEntry } from "@/types/candidate";

// ─── Experience Calculator ────────────────────────────────────────────────────

/**
 * Calculates verified total experience:
 * Start = graduation year of highest degree (Bachelor's or above)
 * End   = today
 * Minus = career gap months from signal profile
 *
 * Falls back to Gemini's claimed total_years_experience when
 * graduation year is unavailable.
 */
function calcVerifiedExperience(
  education: EducationEntry[],
  careerGapMonths: number,
  claimedTotal: string | null,
): { display: string; isCalculated: boolean } {
  const gradYear = resolveGradYear(education);

  if (!gradYear) {
    return {
      display: claimedTotal ?? "",
      isCalculated: false,
    };
  }

  const startDate = new Date(gradYear, 5, 1); // June of grad year
  const now = new Date();
  const totalMonths =
    (now.getFullYear() - startDate.getFullYear()) * 12 +
    (now.getMonth() - startDate.getMonth());

  const netMonths = Math.max(0, totalMonths - careerGapMonths);
  const years = Math.floor(netMonths / 12);
  const months = netMonths % 12;

  let display = "";
  if (years > 0 && months > 0) {
    display = `${years} yr ${months} mo`;
  } else if (years > 0) {
    display = `${years} years`;
  } else {
    display = `${months} months`;
  }

  return { display, isCalculated: true };
}

const DEGREE_RANK: Record<string, number> = {
  phd: 4,
  doctorate: 4,
  "doctor of philosophy": 4,
  mba: 3,
  "master of business administration": 3,
  masters: 3,
  master: 3,
  msc: 3,
  "m.sc": 3,
  "m.tech": 3,
  me: 3,
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
  for (const [pattern, rank] of Object.entries(DEGREE_RANK)) {
    if (key.includes(pattern)) return rank;
  }
  return 1; // treat unknown as diploma-level
}

function resolveGradYear(education: EducationEntry[]): number | null {
  if (!education?.length) return null;

  // Pick highest-ranked degree; if tied, pick latest year
  let best: EducationEntry | null = null;
  let bestRank = 0;

  for (const ed of education) {
    const rank = degreeRank(ed.degree);
    if (rank > bestRank) {
      bestRank = rank;
      best = ed;
    } else if (rank === bestRank && ed.year && best?.year) {
      if (Number(ed.year) > Number(best.year)) best = ed;
    }
  }

  if (!best?.year) return null;
  const y = parseInt(best.year, 10);
  return isNaN(y) || y < 1970 || y > new Date().getFullYear() ? null : y;
}

// ─── LinkedIn Badge ───────────────────────────────────────────────────────────

function LinkedInBadge() {
  return (
    <span
      className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center
        justify-center rounded-full bg-white shadow ring-1 ring-slate-200"
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="#0A66C2">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853
          0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9
          1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337
          7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 114.126 0 2.062
          2.062 0 01-2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225
          0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771
          24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0
          22.222 0h.003z" />
      </svg>
    </span>
  );
}

// ─── Skills Row ───────────────────────────────────────────────────────────────

function SkillsRow({ skills }: { skills: string[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!skills.length) return null;

  const top5 = skills.slice(0, 5);
  const rest = skills.slice(5);

  return (
    <div className="relative mt-2 flex flex-wrap items-center gap-1.5">
      {top5.map((s, i) => (
        <span
          key={i}
          className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs
            font-medium text-[#0D9488]"
        >
          {s}
        </span>
      ))}

      {rest.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-full border border-slate-200 bg-white px-2.5
            py-0.5 text-xs font-medium text-[#64748B] hover:bg-slate-50"
        >
          +{rest.length} more
        </button>
      )}

      {expanded && rest.length > 0 && (
        <div
          className="absolute left-0 top-8 z-20 flex max-w-sm flex-wrap
            gap-1.5 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
        >
          {rest.map((s, i) => (
            <span
              key={i}
              className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs
                font-medium text-[#0D9488]"
            >
              {s}
            </span>
          ))}
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="mt-1 w-full text-center text-xs text-[#94A3B8]
              hover:text-[#64748B]"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Header ──────────────────────────────────────────────────────────────

type CandidatePanelHeaderProps = {
  candidate: CandidateDetail;
  roleBriefTitle?: string | null;
};

export function CandidatePanelHeader({
  candidate,
  roleBriefTitle,
}: CandidatePanelHeaderProps) {
  const profile = candidate.signal_profile;

  const name = resolvePanelDisplayName(
    candidate.display_name,
    profile.display_name,
  );
  const linkedinUrl = resolvePanelLinkedInUrl(
    candidate.linkedin_url,
    profile.linkedin_url,
  );
  const initials = initialsFromName(name);

  const displayTitle = sanitizeDisplayTitle(profile.current_title, {
    roleBriefTitle,
  });
  const displayCompany = profile.current_company?.trim() || null;
  const titleLine =
    displayTitle && displayCompany
      ? `${displayTitle}  ·  ${displayCompany}`
      : displayTitle || displayCompany || null;

  // Verified experience calculation
  const careerGaps =
    (profile as { career_gaps?: { months: number }[] }).career_gaps ?? [];
  const careerGapMonths = careerGaps.reduce(
    (sum, g) => sum + (g.months ?? 0),
    0,
  );
  const { display: expDisplay, isCalculated } = calcVerifiedExperience(
    profile.education ?? [],
    careerGapMonths,
    profile.total_years_experience ?? null,
  );

  // Skills — density order (skills_verified are already ordered by Gemini)
  const allSkills = (profile.skills_verified ?? []).map((s) =>
    typeof s === "string" ? s : s.skill,
  );

  // Education — highest degree + institution
  const topEd = (profile.education ?? []).reduce(
    (best: EducationEntry | null, ed: EducationEntry) =>
      degreeRank(ed.degree) >= degreeRank(best?.degree ?? null) ? ed : best,
    null,
  );

  const avatar = (
    <div className="relative shrink-0">
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full
          bg-[#0D9488]/15 text-lg font-bold text-[#0D9488] select-none"
      >
        {initials || "?"}
      </div>
      {linkedinUrl ? <LinkedInBadge /> : null}
    </div>
  );

  return (
    <div className="flex gap-4 border-b border-[#F1F5F9] pb-5">
      {/* Avatar — links to LinkedIn if available */}
      {linkedinUrl ? (
        <a
          href={linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-full focus:outline-none
            focus-visible:ring-2 focus-visible:ring-[#0D9488]"
          aria-label={`Open ${name} on LinkedIn`}
        >
          {avatar}
        </a>
      ) : (
        avatar
      )}

      <div className="min-w-0 flex-1 space-y-1">

        {/* Full name */}
        <p className="text-xl font-bold leading-tight text-[#1E293B]">
          {name}
        </p>

        {/* Experience */}
        {expDisplay && (
          <p className="text-sm font-semibold text-[#0D9488]">
            {expDisplay}
            {isCalculated ? (
              <span className="ml-1.5 text-xs font-normal text-[#94A3B8]">
                verified
              </span>
            ) : (
              <span className="ml-1.5 text-xs font-normal text-[#94A3B8]">
                claimed
              </span>
            )}
          </p>
        )}

        {/* Current title · company */}
        {titleLine && (
          <p className="text-sm text-[#334155]">{titleLine}</p>
        )}

        {/* Top skills + overflow */}
        <SkillsRow skills={allSkills} />

        {/* Education */}
        {topEd && (
          <p className="text-xs text-[#64748B]">
            {[topEd.degree, topEd.field, topEd.institution, topEd.year]
              .filter(Boolean)
              .join("  ·  ")}
          </p>
        )}

      </div>
    </div>
  );
}
