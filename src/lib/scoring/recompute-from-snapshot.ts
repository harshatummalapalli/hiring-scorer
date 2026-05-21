import type { DimensionKey, FitVerdict } from "@/types/score";
import { scoreToVerdict } from "@/lib/scoring/recruiter-card";

const DIMENSION_KEYS: DimensionKey[] = [
  "skills",
  "trajectory",
  "domain",
  "seniority",
  "tenure",
];

export type RoleBriefWeights = {
  weight_skills: number;
  weight_trajectory: number;
  weight_domain: number;
  weight_seniority: number;
  weight_tenure: number;
};

function clampWeight(n: number): number {
  return Math.max(1, Math.min(10, Math.round(n)));
}

function readDimensionScore(
  dimensionScores: Record<string, { score: number }>,
  key: DimensionKey,
): number {
  const row = dimensionScores[key];
  const raw = row?.score;
  if (typeof raw !== "number" || Number.isNaN(raw)) return 0;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function recomputeOverallFromSnapshot(
  dimensionScores: Record<string, { score: number }>,
  weights: RoleBriefWeights,
): number {
  const w = {
    skills: clampWeight(weights.weight_skills),
    trajectory: clampWeight(weights.weight_trajectory),
    domain: clampWeight(weights.weight_domain),
    seniority: clampWeight(weights.weight_seniority),
    tenure: clampWeight(weights.weight_tenure),
  };

  const total = DIMENSION_KEYS.reduce((s, k) => s + w[k], 0);
  if (total <= 0) return 0;

  const weightedSum = DIMENSION_KEYS.reduce(
    (s, k) => s + readDimensionScore(dimensionScores, k) * w[k],
    0,
  );

  return Math.max(0, Math.min(100, Math.round(weightedSum / total)));
}

export function recomputeVerdictFromSnapshot(
  dimensionScores: Record<string, { score: number }>,
  weights: RoleBriefWeights,
): string {
  return scoreToVerdict(
    recomputeOverallFromSnapshot(dimensionScores, weights),
  );
}

export function recomputeVerdict(overall: number): FitVerdict {
  return scoreToVerdict(overall);
}
