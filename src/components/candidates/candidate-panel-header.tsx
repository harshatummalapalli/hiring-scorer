"use client";

import { sanitizeDisplayTitle } from "@/lib/candidates/candidate-identity-display";
import { initialsFromName } from "@/lib/candidates/list-filters";
import {
  resolvePanelDisplayName,
  resolvePanelLinkedInUrl,
} from "@/lib/candidates/extract-resume-fields";
import type { CandidateDetail } from "@/types/candidate";

function LinkedInBadge() {
  return (
    <span
      className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow ring-1 ring-slate-200"
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="#0A66C2">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 114.126 0 2.062 2.062 0 01-2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    </span>
  );
}

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
      ? `${displayTitle} at ${displayCompany}`
      : displayTitle || displayCompany || null;

  const email =
    candidate.application_email?.trim() ||
    profile.extracted_email?.trim() ||
    null;
  const years =
    profile.experience_years != null
      ? `${Math.round(profile.experience_years)} years`
      : profile.total_years_experience?.trim() &&
          profile.total_years_experience !== "Not stated"
        ? profile.total_years_experience
        : null;
  const location = profile.location?.trim() || null;
  const metaParts = [years, location].filter(Boolean);

  const avatar = (
    <div className="relative shrink-0">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0D9488]/15 text-lg font-semibold text-[#0D9488]">
        {initials || "?"}
      </div>
      {linkedinUrl ? <LinkedInBadge /> : null}
    </div>
  );

  return (
    <div className="flex gap-4 border-b border-[#F1F5F9] pb-4">
      {linkedinUrl ? (
        <a
          href={linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488]"
          aria-label={`Open ${name} on LinkedIn`}
        >
          {avatar}
        </a>
      ) : (
        avatar
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xl font-bold text-[#1E293B]">{name}</p>
        {titleLine ? (
          <p className="mt-0.5 text-sm text-[#334155]">{titleLine}</p>
        ) : null}
        {metaParts.length > 0 ? (
          <p className="mt-0.5 text-sm text-[#64748B]">{metaParts.join(" · ")}</p>
        ) : null}
        {email ? (
          <p className="mt-1 text-xs text-[#64748B]">{email}</p>
        ) : null}
      </div>
    </div>
  );
}
