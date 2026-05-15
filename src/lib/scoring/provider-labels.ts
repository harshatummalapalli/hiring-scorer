import type { ModelRole } from "@/types/score";
import type { FunctionalRole, RoleAssignment } from "@/lib/config/model-configuration";

export const PROVIDER_LABELS: Record<ModelRole, string> = {
  claude: "Claude",
  gpt4o: "GPT-4o",
  gemini: "Gemini Flash",
};

const PROVIDER_ALIASES: Record<string, ModelRole> = {
  claude: "claude",
  "gpt-4o": "gpt4o",
  gpt4o: "gpt4o",
  openai: "gpt4o",
  gemini: "gemini",
  "gemini flash": "gemini",
  google: "gemini",
};

export function normalizeProviderLabel(value: string): string {
  const v = value.trim();
  const lower = v.toLowerCase();
  if (lower === "claude") return PROVIDER_LABELS.claude;
  if (lower === "gpt-4o" || lower === "gpt4o") return PROVIDER_LABELS.gpt4o;
  if (lower.startsWith("gemini")) return PROVIDER_LABELS.gemini;
  return v;
}

export function providerLabelToModelRole(label: string): ModelRole | null {
  const key = label.trim().toLowerCase();
  return PROVIDER_ALIASES[key] ?? null;
}

export function roleAssignmentFromScenarioRoles(
  modelExtractor: string,
  modelAdvocate: string,
  modelScorer: string,
): RoleAssignment | null {
  const extractor = providerLabelToModelRole(modelExtractor);
  const advocate = providerLabelToModelRole(modelAdvocate);
  const scorer = providerLabelToModelRole(modelScorer);

  if (!extractor || !advocate || !scorer) return null;
  if (new Set([extractor, advocate, scorer]).size !== 3) return null;

  const assignment = {} as RoleAssignment;
  assignment[extractor] = "signal_extractor";
  assignment[advocate] = "devils_advocate";
  assignment[scorer] = "structured_scorer";
  return assignment;
}

export function configurationIdFromRoles(
  modelExtractor: string,
  modelAdvocate: string,
  modelScorer: string,
): string {
  const e = providerLabelToModelRole(modelExtractor) ?? "unknown";
  const a = providerLabelToModelRole(modelAdvocate) ?? "unknown";
  const s = providerLabelToModelRole(modelScorer) ?? "unknown";
  return `${e}-extractor_${a}-advocate_${s}-scorer`;
}

export function configurationLabelFromRoles(
  modelExtractor: string,
  modelAdvocate: string,
  modelScorer: string,
): string {
  return `${normalizeProviderLabel(modelExtractor)}=Extractor · ${normalizeProviderLabel(modelAdvocate)}=Advocate · ${normalizeProviderLabel(modelScorer)}=Scorer`;
}
