import type { FunctionalRole } from "@/lib/config/model-configuration";
import { FIXED_MODEL_CONFIGURATION } from "@/lib/config/model-configuration";
import type { ModelRole } from "@/types/score";

/** Recruiter-facing confidence labels (stored in DB and shown in UI). */
export const CONFIDENCE_LABEL_HIGH = "Models agree strongly";
export const CONFIDENCE_LABEL_MEDIUM = "Models have minor disagreement";
export const CONFIDENCE_LABEL_REVIEW = "Human review recommended";

export const CONFIDENCE_LABELS = [
  CONFIDENCE_LABEL_HIGH,
  CONFIDENCE_LABEL_MEDIUM,
  CONFIDENCE_LABEL_REVIEW,
] as const;

export type RecruiterConfidenceLabel = (typeof CONFIDENCE_LABELS)[number];

const LEGACY_TO_RECRUITER: Record<string, RecruiterConfidenceLabel> = {
  "High Confidence": CONFIDENCE_LABEL_HIGH,
  "Medium Confidence": CONFIDENCE_LABEL_MEDIUM,
  "Review Recommended": CONFIDENCE_LABEL_REVIEW,
};

export function toRecruiterConfidenceLabel(
  label: string | null | undefined,
): RecruiterConfidenceLabel {
  if (!label) return CONFIDENCE_LABEL_MEDIUM;
  if (label in LEGACY_TO_RECRUITER) {
    return LEGACY_TO_RECRUITER[label];
  }
  if ((CONFIDENCE_LABELS as readonly string[]).includes(label)) {
    return label as RecruiterConfidenceLabel;
  }
  return CONFIDENCE_LABEL_MEDIUM;
}

export const FUNCTIONAL_ROLE_LABELS: Record<FunctionalRole, string> = {
  signal_extractor: "Signal extractor",
  devils_advocate: "Devil's advocate",
  structured_scorer: "Structured scorer",
};

/** Maps internal model keys to recruiter-facing role names (fixed production config). */
export function modelRoleDisplayName(model: ModelRole): string {
  const role = FIXED_MODEL_CONFIGURATION.assignment[model];
  return FUNCTIONAL_ROLE_LABELS[role];
}

export const MODEL_ROLE_DISPLAY: Record<ModelRole, string> = {
  gpt4o: modelRoleDisplayName("gpt4o"),
  claude: modelRoleDisplayName("claude"),
  gemini: modelRoleDisplayName("gemini"),
};

export const CONSENSUS_SUMMARY =
  "Three specialized evaluators run in parallel: one extracts signals, one surfaces risks and gaps, and one scores each dimension.";

export function confidenceBadgeClass(label: string | null | undefined): string {
  const normalized = toRecruiterConfidenceLabel(label);
  if (normalized === CONFIDENCE_LABEL_HIGH) {
    return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  }
  if (normalized === CONFIDENCE_LABEL_MEDIUM) {
    return "bg-amber-100 text-amber-800 ring-amber-200";
  }
  if (normalized === CONFIDENCE_LABEL_REVIEW) {
    return "bg-red-100 text-red-800 ring-red-200";
  }
  return "bg-slate-100 text-slate-700 ring-slate-200";
}
