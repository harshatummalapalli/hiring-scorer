import {
  CONFIDENCE_LABEL_HIGH,
  CONFIDENCE_LABEL_MEDIUM,
  CONFIDENCE_LABEL_REVIEW,
} from "@/lib/scoring/recruiter-labels";
import type { DimensionKey } from "@/types/score";
import type {
  DevilsAdvocateResult,
  SignalExtractorResult,
  StructuredScorerResult,
} from "./model-runners";

export type DimensionAgreement = "unanimous" | "majority" | "divergent";

export type DimensionModelCell = {
  score: number;
  reason: string;
  dimension_flag: string;
};

export function agreementToConfidenceLabel(
  agreement: DimensionAgreement,
): typeof CONFIDENCE_LABEL_HIGH | typeof CONFIDENCE_LABEL_MEDIUM | typeof CONFIDENCE_LABEL_REVIEW {
  if (agreement === "unanimous") return CONFIDENCE_LABEL_HIGH;
  if (agreement === "majority") return CONFIDENCE_LABEL_MEDIUM;
  return CONFIDENCE_LABEL_REVIEW;
}

export function formatSignalExtractorDimension(
  dim: SignalExtractorResult["dimensions"][DimensionKey],
): { reason: string; dimension_flag: string } {
  const reason =
    dim.inference_notes?.trim() ||
    dim.concerning_signals[0]?.trim() ||
    dim.positive_signals[0]?.trim() ||
    "—";

  const flagParts: string[] = [];
  if (dim.positive_signals.length) {
    flagParts.push(`Positive: ${dim.positive_signals.join("; ")}`);
  }
  if (dim.concerning_signals.length) {
    flagParts.push(`Concerning: ${dim.concerning_signals.join("; ")}`);
  }
  if (dim.inference_notes?.trim()) {
    flagParts.push(`Inference: ${dim.inference_notes.trim()}`);
  }

  return {
    reason,
    dimension_flag: flagParts.length > 0 ? flagParts.join(" · ") : "No signals extracted",
  };
}

export function formatDevilsAdvocateDimension(
  dim: DevilsAdvocateResult["dimension_scores"][DimensionKey],
): { reason: string; dimension_flag: string } {
  const reason = dim.reason?.trim() || "—";
  return {
    reason,
    dimension_flag: reason !== "—" ? reason : "No dimension-specific risk noted",
  };
}

export function formatStructuredScorerDimension(
  dim: StructuredScorerResult["dimensions"][DimensionKey],
): { reason: string; dimension_flag: string } {
  const reason = dim.reason?.trim() || "—";
  const flag = dim.insufficient_data
    ? `${reason !== "—" ? `${reason} · ` : ""}Insufficient data — scored 0`
    : reason !== "—"
      ? reason
      : "No scoring reason provided";
  return { reason, dimension_flag: flag };
}

export function buildDimensionModelDetails(
  key: DimensionKey,
  signalExtractor: SignalExtractorResult,
  devilsAdvocate: DevilsAdvocateResult,
  structuredScorer: StructuredScorerResult,
): {
  gpt4o: DimensionModelCell;
  claude: DimensionModelCell;
  gemini: DimensionModelCell;
} {
  const geminiCell = formatSignalExtractorDimension(signalExtractor.dimensions[key]);
  const claudeCell = formatDevilsAdvocateDimension(devilsAdvocate.dimension_scores[key]);
  const gptCell = formatStructuredScorerDimension(structuredScorer.dimensions[key]);

  return {
    gpt4o: {
      score: structuredScorer.dimensions[key].score,
      reason: gptCell.reason,
      dimension_flag: gptCell.dimension_flag,
    },
    claude: {
      score: devilsAdvocate.dimension_scores[key].score,
      reason: claudeCell.reason,
      dimension_flag: claudeCell.dimension_flag,
    },
    gemini: {
      score: signalExtractor.dimensions[key].score,
      reason: geminiCell.reason,
      dimension_flag: geminiCell.dimension_flag,
    },
  };
}
