import type { DimensionKey } from "@/types/score";

export type ScoringRunDimensionScores = Record<
  DimensionKey,
  {
    score: number;
    provisional?: boolean;
    rationale?: string;
  }
>;

export type ScoringRunPerModelScores = Record<
  DimensionKey,
  { claude: number; gpt4o: number; gemini: number }
>;

export type ScoringRunConfidenceLevels = Record<
  DimensionKey,
  {
    agreement: string;
    confidence_label: string;
  }
>;

export type ScoringRunSpreads = Record<DimensionKey, number>;

export type ScoringRun = {
  id: string;
  candidate_filename: string;
  scenario_label: string;
  model_extractor: string;
  model_advocate: string;
  model_scorer: string;
  overall_score: number;
  dimension_scores: ScoringRunDimensionScores | null;
  per_model_scores: ScoringRunPerModelScores | null;
  confidence_levels: ScoringRunConfidenceLevels | null;
  spreads: ScoringRunSpreads | null;
  created_at: string;
};

export type ScoringRunInsert = Omit<ScoringRun, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};
