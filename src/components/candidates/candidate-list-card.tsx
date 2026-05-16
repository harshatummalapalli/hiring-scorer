import Link from "next/link";
import type { CandidateListItem } from "@/types/candidate";
import {
  formatListCardSubtitle,
  getCandidateHeaderName,
} from "@/lib/candidates/profile-display";
import { initialsFromName, shortVerdictLabel } from "@/lib/candidates/list-filters";
import { VERDICT_BADGE } from "./profile-shared";

type CandidateListCardProps = {
  candidate: CandidateListItem;
};

export function CandidateListCard({ candidate }: CandidateListCardProps) {
  const profile = candidate.signal_profile;
  const displayName = getCandidateHeaderName(profile);
  const subtitle = formatListCardSubtitle(profile);
  const topSkills = profile.skills_verified.slice(0, 3);

  return (
    <Link
      href={`/candidates/${candidate.id}`}
      className="group block rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-900 text-base font-semibold text-white"
          aria-hidden
        >
          {initialsFromName(displayName)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-lg font-bold text-[#0a1628] group-hover:text-slate-900">
              {displayName}
            </h3>
            {candidate.tag && (
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                {candidate.tag}
              </span>
            )}
          </div>

          {subtitle ? (
            <p className="mt-0.5 text-sm text-slate-600">{subtitle}</p>
          ) : null}

          {topSkills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {topSkills.map((s) => (
                <span
                  key={s.skill}
                  className="rounded-full border border-emerald-300/80 bg-emerald-50/50 px-2 py-0.5 text-xs font-medium text-slate-700"
                >
                  {s.skill}
                </span>
              ))}
            </div>
          )}

          {candidate.role_scores.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {candidate.role_scores.map((score) => {
                const styles = VERDICT_BADGE[score.verdict];
                const roleLabel =
                  score.role_brief_title?.trim() || "Role";
                const shortRole =
                  roleLabel.length > 22
                    ? `${roleLabel.slice(0, 20)}…`
                    : roleLabel;
                return (
                  <span
                    key={score.id}
                    title={`${roleLabel}: ${score.overall_score} — ${score.verdict}`}
                    className={`inline-flex max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles.bg} ${styles.text} ${styles.ring}`}
                  >
                    <span className="truncate">{shortRole}</span>
                    <span className="opacity-70">·</span>
                    <span className="shrink-0">
                      {shortVerdictLabel(score.verdict)}
                    </span>
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-400">Not scored against any roles yet</p>
          )}
        </div>
      </div>
    </Link>
  );
}
