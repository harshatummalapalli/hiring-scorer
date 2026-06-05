import type { TitleBand } from "@/types/role-brief";
import type { RoleBriefSuggestedWeights } from "@/types/role-brief";

export type WorkMode = "on-site" | "hybrid" | "remote";

export const GENERIC_SOFT_SKILLS = new Set([
  "communication skills",
  "teamwork",
  "team player",
  "interpersonal skills",
  "problem solving",
  "problem-solving skills",
  "analytical skills",
  "time management",
  "adaptability",
  "leadership skills",
  "attention to detail",
  "work ethic",
  "self-motivated",
  "quick learner",
  "fast learner",
  "multitasking",
  "organizational skills",
]);

export const WIZARD_SENIORITY_OPTIONS: { label: string; band: TitleBand }[] = [
  { label: "Junior", band: "Entry" },
  { label: "Mid", band: "Mid" },
  { label: "Senior", band: "Senior" },
  { label: "Lead", band: "Lead" },
  { label: "Staff", band: "Staff" },
  { label: "Principal", band: "Principal" },
];

export const WORK_MODE_OPTIONS: { id: WorkMode; label: string }[] = [
  { id: "on-site", label: "On-site" },
  { id: "hybrid", label: "Hybrid" },
  { id: "remote", label: "Remote" },
];

export const DEFAULT_WIZARD_WEIGHTS: RoleBriefSuggestedWeights = {
  weight_skills: 7,
  weight_trajectory: 6,
  weight_domain: 5,
  weight_seniority: 7,
  weight_tenure: 5,
};

export const WEIGHT_PRESETS: Record<
  string,
  RoleBriefSuggestedWeights
> = {
  technical: {
    weight_skills: 9,
    weight_trajectory: 5,
    weight_domain: 6,
    weight_seniority: 6,
    weight_tenure: 4,
  },
  leadership: {
    weight_skills: 6,
    weight_trajectory: 8,
    weight_domain: 7,
    weight_seniority: 9,
    weight_tenure: 6,
  },
  balanced: {
    weight_skills: 6,
    weight_trajectory: 6,
    weight_domain: 6,
    weight_seniority: 6,
    weight_tenure: 6,
  },
};

export function filterCannotAssessItems(items: string[]): string[] {
  return items
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !GENERIC_SOFT_SKILLS.has(s.toLowerCase()))
    .slice(0, 5);
}

export function formatWizardJobLocation(
  location: string,
  workMode: WorkMode,
): string {
  const loc = location.trim();
  const mode =
    WORK_MODE_OPTIONS.find((o) => o.id === workMode)?.label ?? workMode;
  if (!loc) return mode;
  return `${loc} · ${mode}`;
}
