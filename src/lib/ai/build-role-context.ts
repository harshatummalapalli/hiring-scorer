import type { RoleBrief } from "@/types/role-brief";

export function buildRoleContext(roleBrief: RoleBrief, resumeText: string): string {
  return `ROLE BRIEF:
Title: ${roleBrief.title}
Department: ${roleBrief.department ?? "N/A"}
Responsibilities: ${roleBrief.responsibilities ?? "N/A"}
Required skills: ${roleBrief.required_skills ?? "N/A"}
Nice-to-have skills: ${roleBrief.nice_to_have_skills ?? "N/A"}
Experience years: ${roleBrief.experience_years ?? "N/A"}
Scoring weights (1-10): skills=${roleBrief.weight_skills}, trajectory=${roleBrief.weight_trajectory}, domain=${roleBrief.weight_domain}, seniority=${roleBrief.weight_seniority}, tenure=${roleBrief.weight_tenure}

CANDIDATE PROFILE (PII redacted):
${resumeText}`;
}
