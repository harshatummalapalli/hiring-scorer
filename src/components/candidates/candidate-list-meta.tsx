import { formatTotalExperienceDisplay } from "@/lib/candidates/format-total-experience";
import { formatTitleAtCompanySubtitle } from "@/lib/candidates/profile-display";

type CandidateListMetaProps = {
  currentTitle?: string | null;
  currentCompany?: string | null;
  yearsExperience?: string | null;
};

export function CandidateListMeta({
  currentTitle,
  currentCompany,
  yearsExperience,
}: CandidateListMetaProps) {
  const roleLine = formatTitleAtCompanySubtitle(currentTitle, currentCompany);
  const years = formatTotalExperienceDisplay(yearsExperience ?? null);
  const hasYears = years && years !== "—";

  if (!roleLine && !hasYears) return null;

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
      {hasYears ? (
        <p
          className={
            roleLine
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
