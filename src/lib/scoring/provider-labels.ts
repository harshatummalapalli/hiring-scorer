import type { ModelRole } from "@/types/score";

/** Labels written to scoring_runs for legacy multi-model metadata (recruiter-facing roles). */
export const PROVIDER_LABELS: Record<ModelRole, string> = {
  claude: "Risk reviewer",
  gpt4o: "Structured scorer",
  gemini: "Signal extractor",
};
