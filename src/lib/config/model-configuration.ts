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

/** Production match scoring: GPT-4o mini only. */
export const FIXED_MODEL_CONFIGURATION: ModelConfiguration = {
  id: "gpt4o-mini-scorer",
  label: "GPT-4o mini (candidate match)",
  assignment: {
    gemini: "signal_extractor",
    claude: "devils_advocate",
    gpt4o: "structured_scorer",
  },
};

export function getModelConfiguration(): ModelConfiguration {
  return FIXED_MODEL_CONFIGURATION;
}
