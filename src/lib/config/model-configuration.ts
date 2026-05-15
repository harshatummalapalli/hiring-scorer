import type { ModelRole } from "@/types/score";

export type FunctionalRole =
  | "signal_extractor"
  | "devils_advocate"
  | "structured_scorer";

export type RoleAssignment = Record<ModelRole, FunctionalRole>;

export type ModelConfiguration = {
  id: string;
  label: string;
  assignment: RoleAssignment;
};

/** Permanent production configuration — do not change without product sign-off. */
export const FIXED_MODEL_CONFIGURATION: ModelConfiguration = {
  id: "gemini-extractor_claude-advocate_gpt-scorer",
  label:
    "Gemini Flash=Signal Extractor · Claude=Devil's Advocate · GPT-4o=Structured Scorer",
  assignment: {
    gemini: "signal_extractor",
    claude: "devils_advocate",
    gpt4o: "structured_scorer",
  },
};

export function getModelConfiguration(): ModelConfiguration {
  return FIXED_MODEL_CONFIGURATION;
}

/** @deprecated use getModelConfiguration */
export const CURRENT_MODEL_CONFIGURATION = FIXED_MODEL_CONFIGURATION;
export const getCurrentModelConfiguration = getModelConfiguration;

export function scoreByFunctionalRole(
  assignment: RoleAssignment,
  modelScores: { claude: number; gpt4o: number; gemini: number },
): Record<FunctionalRole, number> {
  const out = {} as Record<FunctionalRole, number>;
  (["gpt4o", "claude", "gemini"] as ModelRole[]).forEach((model) => {
    out[assignment[model]] = modelScores[model];
  });
  return out;
}

export function modelForFunctionalRole(
  assignment: RoleAssignment,
  role: FunctionalRole,
): ModelRole {
  const entry = (Object.entries(assignment) as [ModelRole, FunctionalRole][]).find(
    ([, r]) => r === role,
  );
  if (!entry) throw new Error(`No model assigned to ${role}`);
  return entry[0];
}
