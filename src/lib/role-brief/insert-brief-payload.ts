import type { RoleBriefAnalysis } from "@/types/role-brief";
import { roleBriefToSavePayload } from "@/types/role-brief";

const V2_KEYS = [
  "job_description",
  "deal_breakers",
  "core_signals",
  "preferred_signals",
  "cannot_assess",
  "equivalent_titles",
  "title_band",
  "semantic_clusters",
] as const;

export function buildFullBriefPayload(
  title: string,
  jobDescription: string,
  analysis: RoleBriefAnalysis,
): Record<string, unknown> {
  return roleBriefToSavePayload(title, jobDescription, analysis);
}

export function buildLegacyBriefPayload(
  title: string,
  jobDescription: string,
  analysis: RoleBriefAnalysis,
): Record<string, unknown> {
  const coreText = analysis.core_signals.map((s) => s.skill).join(", ");
  return {
    title: title.trim(),
    department: null,
    responsibilities: jobDescription.trim().slice(0, 8000) || null,
    required_skills: coreText || analysis.deal_breakers.join(", ") || null,
    nice_to_have_skills: analysis.preferred_signals.join(", ") || null,
    experience_years: null,
    weight_skills: 5,
    weight_trajectory: 5,
    weight_domain: 5,
    weight_seniority: 5,
    weight_tenure: 5,
  };
}

export function stripV2Columns(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const row = { ...payload };
  for (const key of V2_KEYS) {
    delete row[key];
  }
  return row;
}

export function isMissingV2ColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("schema cache") ||
    lower.includes("could not find") ||
    V2_KEYS.some((k) => lower.includes(k))
  );
}
