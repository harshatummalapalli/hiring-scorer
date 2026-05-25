import type { ModelRole } from "@/types/score";

/** Labels written to scoring_runs for legacy multi-model metadata (production uses GPT-4o mini only). */
export const PROVIDER_LABELS: Record<ModelRole, string> = {
  claude: "Claude",
  gpt4o: "GPT-4o",
  gemini: "Gemini Flash",
};
