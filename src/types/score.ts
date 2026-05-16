import {
  CONSENSUS_SUMMARY,
  MODEL_ROLE_DISPLAY,
} from "@/lib/scoring/recruiter-labels";

export type AiProvider = "anthropic" | "openai" | "google";

export type ModelRole = "claude" | "gpt4o" | "gemini";

export type DimensionKey =
  | "skills"
  | "trajectory"
  | "domain"
  | "seniority"
  | "tenure";

export type AttributedFlag = {
  text: string;
  sources: ModelRole[];
  sourceLabel: string;
};

export type DimensionScore = {
  score: number;
  rationale: string;
  /** True when models diverged; score is a provisional average. */
  provisional?: boolean;
  model_scores?: {
    claude: number;
    gpt4o: number;
    gemini: number;
  };
  agreement?: "unanimous" | "majority" | "divergent";
  dissent?: {
    model: ModelRole;
    modelLabel: string;
    score: number;
    reason?: string;
  };
};

export type DimensionModelCell = {
  score: number;
  reason: string;
  dimension_flag: string;
};

export type DimensionConsensusDetail = {
  key: DimensionKey;
  label: string;
  model_scores: {
    claude: number;
    gpt4o: number;
    gemini: number;
  };
  model_details: {
    gpt4o: DimensionModelCell;
    claude: DimensionModelCell;
    gemini: DimensionModelCell;
  };
  spread: number;
  agreement: "unanimous" | "majority" | "divergent";
  dimension_confidence_label: string;
  consensus_score: number | null;
  /** Average of model scores when agreement is divergent. */
  provisional_score: number | null;
  dissent?: {
    model: ModelRole;
    modelLabel: string;
    score: number;
    reason?: string;
  };
  rationale: string;
};

export type ModelRawResponses = {
  gpt4o: unknown;
  claude: unknown;
  gemini: unknown;
};

export type CompanyType = "Services" | "Product" | "GCC" | "Startup";

export type WorkHistoryEntry = {
  company: string;
  type: CompanyType;
};

export type CandidateHeader = {
  display_name: string;
  most_recent_title: string;
  total_years_experience: string;
  career_pattern: string;
};

export type StandoutBullet = {
  signal: string;
  evidence: string;
};

export type FitVerdict =
  | "STRONG FIT"
  | "POSSIBLE FIT"
  | "WEAK FIT"
  | "NOT SUITABLE";

export type RecruiterCard = {
  candidate_header: CandidateHeader;
  what_stands_out: StandoutBullet[];
  worth_exploring: string[];
  interview_questions: string[];
};

export type CandidateScoreResult = {
  overall_score: number;
  /** True when overall used provisional scores for one or more dimensions. */
  overall_provisional: boolean;
  confidence_level: "high" | "medium" | "low" | "review";
  confidence_label: string;
  review_recommended: boolean;
  dimension_scores: Record<DimensionKey, DimensionScore>;
  dimension_consensus: DimensionConsensusDetail[];
  green_flags: AttributedFlag[];
  watch_signals: AttributedFlag[];
  review_flags: AttributedFlag[];
  risks: AttributedFlag[];
  gaps: AttributedFlag[];
  dissent_signals: string[];
  model_raw_responses: ModelRawResponses;
  model_flags: {
    claude: { risks: string[]; gaps: string[] };
    gpt4o: { insufficient: string[] };
    gemini: { green_flags: string[]; watch_signals: string[] };
  };
  recruiter_card: RecruiterCard;
};

export type SavedScore = {
  id: string;
  candidate_filename: string | null;
  role_brief_id: string | null;
  role_brief_title: string | null;
  overall_score: number | null;
  confidence_level: string | null;
  dimension_scores: Record<DimensionKey, DimensionScore> | null;
  green_flags: AttributedFlag[] | string[] | null;
  watch_signals: AttributedFlag[] | string[] | null;
  review_flags: AttributedFlag[] | string[] | null;
  tag: string | null;
  recruiter_notes: string | null;
  created_at: string;
};

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  skills: "Skills match",
  trajectory: "Career trajectory",
  domain: "Domain expertise",
  seniority: "Seniority fit",
  tenure: "Tenure stability",
};

export const SCORE_TAGS = [
  "Strong Yes",
  "Yes",
  "Maybe",
  "No",
  "Hold",
] as const;

/** Recruiter-facing role labels (no vendor/model names). */
export const MODEL_ROLE_LABELS: Record<ModelRole, string> = MODEL_ROLE_DISPLAY;

/** Short labels for consensus narrative */
export const MODEL_CONSENSUS_DESCRIPTION = CONSENSUS_SUMMARY;
