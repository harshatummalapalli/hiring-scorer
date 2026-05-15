import { FIXED_MODEL_CONFIGURATION } from "@/lib/config/model-configuration";
import {
  configurationLabelFromRoles,
  PROVIDER_LABELS,
} from "@/lib/scoring/provider-labels";
import type {
  ScoringRunConfidenceLevels,
  ScoringRunDimensionScores,
  ScoringRunInsert,
  ScoringRunPerModelScores,
  ScoringRunSpreads,
} from "@/types/scoring-run";
import type { CandidateScoreResult, DimensionKey } from "@/types/score";

const DIMENSION_KEYS: DimensionKey[] = [
  "skills",
  "trajectory",
  "domain",
  "seniority",
  "tenure",
];

function modelRoleForFunctional(
  functional: "signal_extractor" | "devils_advocate" | "structured_scorer",
): keyof typeof PROVIDER_LABELS {
  const entry = Object.entries(FIXED_MODEL_CONFIGURATION.assignment).find(
    ([, role]) => role === functional,
  );
  return (entry?.[0] ?? "gemini") as keyof typeof PROVIDER_LABELS;
}

export function buildScoringRunPayloadFromResult(
  candidateFilename: string,
  result: CandidateScoreResult,
  options?: {
    scenarioLabel?: string;
    modelExtractor?: string;
    modelAdvocate?: string;
    modelScorer?: string;
  },
): ScoringRunInsert {
  const modelExtractor =
    options?.modelExtractor ??
    PROVIDER_LABELS[modelRoleForFunctional("signal_extractor")];
  const modelAdvocate =
    options?.modelAdvocate ??
    PROVIDER_LABELS[modelRoleForFunctional("devils_advocate")];
  const modelScorer =
    options?.modelScorer ??
    PROVIDER_LABELS[modelRoleForFunctional("structured_scorer")];

  const scenarioLabel =
    options?.scenarioLabel ?? "Production (live)";

  const dimension_scores = {} as ScoringRunDimensionScores;
  const per_model_scores = {} as ScoringRunPerModelScores;
  const confidence_levels = {} as ScoringRunConfidenceLevels;
  const spreads = {} as ScoringRunSpreads;

  for (const key of DIMENSION_KEYS) {
    const dim = result.dimension_scores[key];
    const detail = result.dimension_consensus.find((d) => d.key === key);

    dimension_scores[key] = {
      score: dim.score,
      provisional: dim.provisional,
      rationale: dim.rationale,
    };

    if (detail) {
      per_model_scores[key] = { ...detail.model_scores };
      spreads[key] = detail.spread;
      confidence_levels[key] = {
        agreement: detail.agreement,
        confidence_label: detail.dimension_confidence_label,
      };
    } else if (dim.model_scores) {
      per_model_scores[key] = { ...dim.model_scores };
      spreads[key] = 0;
      confidence_levels[key] = {
        agreement: dim.agreement ?? "unanimous",
        confidence_label: result.confidence_label,
      };
    }
  }

  return {
    candidate_filename: candidateFilename,
    scenario_label: scenarioLabel,
    model_extractor: modelExtractor,
    model_advocate: modelAdvocate,
    model_scorer: modelScorer,
    overall_score: result.overall_score,
    dimension_scores,
    per_model_scores,
    confidence_levels,
    spreads,
  };
}

export function buildManualScoringRunPayload(input: {
  candidate_filename: string;
  scenario_label: string;
  model_extractor: string;
  model_advocate: string;
  model_scorer: string;
  overall_score: number;
  dimension_scores?: ScoringRunDimensionScores | null;
  per_model_scores?: ScoringRunPerModelScores | null;
  confidence_levels?: ScoringRunConfidenceLevels | null;
  spreads?: ScoringRunSpreads | null;
}): ScoringRunInsert {
  return {
    candidate_filename: input.candidate_filename.trim(),
    scenario_label: input.scenario_label.trim(),
    model_extractor: input.model_extractor.trim(),
    model_advocate: input.model_advocate.trim(),
    model_scorer: input.model_scorer.trim(),
    overall_score: Math.round(input.overall_score),
    dimension_scores: input.dimension_scores ?? null,
    per_model_scores: input.per_model_scores ?? null,
    confidence_levels: input.confidence_levels ?? null,
    spreads: input.spreads ?? null,
  };
}
