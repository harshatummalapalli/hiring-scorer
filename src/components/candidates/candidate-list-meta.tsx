import { formatTotalExperienceDisplay } from "@/lib/candidates/format-total-experience";
import {
  formatTitleAtCompanySubtitle,
  getTalentPoolBulletFallbackDisplay,
} from "@/lib/candidates/profile-display";
import type { CandidateSignalProfile } from "@/types/candidate";

type CandidateListMetaProps = {
  currentTitle?: string | null;
  currentCompany?: string | null;
  yearsExperience?: string | null;
  /** When set (Talent Pool), shows formatted resume-bullet fallback if title/company are missing. */
  signalProfile?: CandidateSignalProfile | null;
  /** Show experience years line (off on Talent Pool cards — years shown elsewhere). */
  showYears?: boolean;
};

export function CandidateListMeta({
  currentTitle,
  currentCompany,
  yearsExperience,
  signalProfile,
  showYears = true,
}: CandidateListMetaProps) {
  const roleLine = formatTitleAtCompanySubtitle(currentTitle, currentCompany);
  const bulletFallback =
    signalProfile && !roleLine
      ? getTalentPoolBulletFallbackDisplay(signalProfile)
      : null;
  const years = showYears
    ? formatTotalExperienceDisplay(yearsExperience ?? null)
    : null;
  const hasYears = Boolean(years && years !== "—");

  if (!roleLine && !hasYears && !bulletFallback) return null;

  return (
    <div className="mt-1.5 min-w-0 space-y-0.5">
      {roleLine ? (
        <p
          className="truncate text-sm leading-snug text-[#475569]"
          title={roleLine}
        >
          {roleLine}
        </p>
      ) : null}
      {!roleLine && bulletFallback ? (
        <p
          className="truncate text-xs leading-snug text-[#94A3B8]"
          title={bulletFallback}
        >
          {bulletFallback}
        </p>
      ) : null}
      {hasYears ? (
        <p
          className={
            roleLine || bulletFallback
              ? "text-xs text-[#94A3B8]"
              : "text-sm text-[#64748B]"
          }
        >
          {years}
        </p>
      ) : null}
    </div>
  );
}
