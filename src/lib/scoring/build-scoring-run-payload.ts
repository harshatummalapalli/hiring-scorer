import { FIXED_MODEL_CONFIGURATION } from "@/lib/config/model-configuration";
import { PROVIDER_LABELS } from "@/lib/scoring/provider-labels";
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
