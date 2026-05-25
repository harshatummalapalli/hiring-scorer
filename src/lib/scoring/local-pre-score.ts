import type { CandidateSignalProfile } from "@/types/candidate";
import type { RoleBrief } from "@/types/role-brief";

export function computeLocalPreScore(
  profile: CandidateSignalProfile,
  roleBrief: RoleBrief,
): number {
  let score = 0;

  // Experience vs role minimum (0-25 points)
  const exp = parseFloat(
    (profile.total_years_experience ?? "0")
      .replace(/[^0-9.]/g, "") || "0",
  );
  const minExp =
    roleBrief.title_band === "Senior"
      ? 5
      : roleBrief.title_band === "Lead"
        ? 7
        : roleBrief.title_band === "Mid"
          ? 3
          : roleBrief.title_band === "Staff"
            ? 8
            : 2;
  const expRatio = Math.min(exp / Math.max(minExp, 1), 1.3);
  score += Math.round(expRatio * 25);

  // Must-have skill overlap (0-35 points)
  const mustHaves = roleBrief.deal_breakers ?? [];
  const allSkills = (profile.top_skills ?? []).map((s) => s.toLowerCase());
  const resumeText = (profile.professional_summary ?? "").toLowerCase();

  if (mustHaves.length > 0) {
    const matched = mustHaves.filter(
      (mh) =>
        allSkills.some((s) => s.includes(mh.toLowerCase())) ||
        resumeText.includes(mh.toLowerCase()),
    ).length;
    score += Math.round((matched / mustHaves.length) * 35);
  } else {
    score += 20; // neutral when no must-haves defined
  }

  // Career stability (0-20 points)
  const gaps = profile.career_gaps ?? [];
  const longGaps = gaps.filter((g) => g.months > 6).length;
  score += Math.max(0, 20 - longGaps * 7);

  // Seniority match (0-20 points)
  const currentTitle = (profile.current_title ?? "").toLowerCase();
  const roleBand = (roleBrief.title_band ?? "").toLowerCase();
  if (currentTitle.includes(roleBand) || roleBand.includes("mid")) {
    score += 20;
  } else if (
    currentTitle.includes("senior") ||
    currentTitle.includes("lead")
  ) {
    score += 14;
  } else {
    score += 8;
  }

  return Math.min(Math.max(score, 5), 94);
}
