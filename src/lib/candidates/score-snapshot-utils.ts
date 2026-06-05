import type { CandidateScoreResult } from "@/types/score";

type SnapshotWithContradictions = CandidateScoreResult & {
  contradictions?: string[];
};

export function extractContradictions(
  result: CandidateScoreResult | null | undefined,
): string[] {
  if (!result) return [];

  const snap = result as SnapshotWithContradictions;
  if (Array.isArray(snap.contradictions)) {
    return snap.contradictions
      .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
      .map((c) => c.trim());
  }

  const gpt = result.model_raw_responses?.gpt4o;
  if (gpt && typeof gpt === "object" && "contradictions" in gpt) {
    const raw = (gpt as { contradictions?: unknown }).contradictions;
    if (Array.isArray(raw)) {
      return raw
        .map(String)
        .map((c) => c.trim())
        .filter(Boolean);
    }
  }

  return [];
}
