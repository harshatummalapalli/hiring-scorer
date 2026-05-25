import type { DimensionConsensusDetail, ModelRawResponses } from "@/types/score";

/** True when saved score includes legacy 3-model dimension cells (not GPT-4o mini only). */
export function dimensionHasLegacyMultiModel(
  detail: DimensionConsensusDetail,
): boolean {
  const { model_details: m } = detail;
  return m.claude != null || m.gemini != null;
}

/** True when saved score includes legacy per-model raw JSON (not GPT-4o mini only). */
export function rawResponsesHasLegacyMultiModel(raw: ModelRawResponses): boolean {
  return raw.claude != null || raw.gemini != null;
}
