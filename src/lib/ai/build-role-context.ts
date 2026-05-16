import type { RoleBrief } from "@/types/role-brief";

function formatList(items: string[], empty = "None listed"): string {
  return items.length > 0 ? items.join("; ") : empty;
}

function formatCoreSignals(
  signals: RoleBrief["core_signals"],
): string {
  if (!signals.length) return "None listed";
  return signals
    .map((s) => {
      const eq =
        s.equivalents.length > 0
          ? ` (equivalents: ${s.equivalents.join(", ")})`
          : "";
      return `${s.skill}${eq}`;
    })
    .join("; ");
}

function formatSemanticClusters(
  clusters: Record<string, string[]>,
): string {
  const entries = Object.entries(clusters);
  if (entries.length === 0) return "None listed";
  return entries
    .map(([skill, techs]) => `${skill}: ${techs.join(", ") || "—"}`)
    .join("; ");
}

export function buildRoleContext(roleBrief: RoleBrief, resumeText: string): string {
  const jd = roleBrief.job_description?.trim();

  return `ROLE BRIEF:
Title: ${roleBrief.title}
Seniority band: ${roleBrief.title_band ?? "Not specified"}
Equivalent titles: ${formatList(roleBrief.equivalent_titles)}
Deal breakers (must-have — absence disqualifies): ${formatList(roleBrief.deal_breakers)}
Core signals (high scoring weight): ${formatCoreSignals(roleBrief.core_signals)}
Preferred signals (boost score, not required): ${formatList(roleBrief.preferred_signals)}
Cannot assess from resume alone: ${formatList(roleBrief.cannot_assess)}
Semantic skill clusters: ${formatSemanticClusters(roleBrief.semantic_clusters)}
${jd ? `\nOriginal job description:\n${jd}` : ""}

Scoring weights (1-10): skills=${roleBrief.weight_skills}, trajectory=${roleBrief.weight_trajectory}, domain=${roleBrief.weight_domain}, seniority=${roleBrief.weight_seniority}, tenure=${roleBrief.weight_tenure}

CANDIDATE PROFILE (PII redacted):
${resumeText}`;
}
