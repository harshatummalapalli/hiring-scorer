import type { CandidateSignalProfile } from "@/types/candidate";

export function formatCandidateSignalProfileBlock(
  profile: CandidateSignalProfile,
): string {
  const expSummary = profile.experience
    .slice(0, 5)
    .map(
      (e) =>
        `- ${e.title} @ ${e.company} (${e.company_type}) ${e.start_date ?? ""}–${e.end_date ?? ""}`,
    )
    .join("\n");

  return `
STORED CANDIDATE SIGNAL PROFILE (structured — prefer this over re-parsing basics):
Name: ${profile.display_name}
Most recent title: ${profile.most_recent_title}
Years experience: ${profile.total_years_experience}
Career pattern: ${profile.career_pattern}
Location: ${profile.location ?? "Not stated"}
Summary: ${profile.professional_summary.slice(0, 500)}
Ownership ratio: ${profile.ownership_ratio_percent}%
Quantification ratio: ${profile.quantification_ratio_percent}%
Trajectory: ${profile.trajectory_velocity}
Keyword stuffing flagged: ${profile.keyword_stuffing_flagged}

Experience (parsed):
${expSummary || "None parsed"}

Verified skills: ${profile.skills_verified.map((s) => s.skill).join(", ") || "None"}
`.trim();
}
