/** Legacy model output shapes for replay / debug UI (live scoring uses gpt-mini-scorer). */

export type GreenFlagEntry = {
  text: string;
  dimension?: string;
  evidence_quote?: string;
};

export type SignalExtractorResult = {
  dimensions: Record<
    string,
    {
      score: number;
      positive_signals: string[];
      concerning_signals: string[];
      inference_notes?: string;
    }
  >;
  green_flags: GreenFlagEntry[];
  watch_signals: { text: string; dimension?: string }[];
  candidate_profile?: {
    most_recent_title?: string;
    total_years_experience?: number | string;
    work_history?: { company: string; type: string }[];
    career_pattern?: string;
  };
};

export type DevilsAdvocateResult = {
  risks: string[];
  gaps: string[];
  interview_questions: string[];
  dimension_scores: Record<string, { score: number; reason: string }>;
};

export type StructuredScorerResult = {
  dimensions: Record<
    string,
    { score: number; reason: string; insufficient_data?: boolean }
  >;
};
