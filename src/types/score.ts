import {
  CONSENSUS_SUMMARY,
  MODEL_ROLE_DISPLAY,
} from "@/lib/scoring/recruiter-labels";
import type { ResumeQualitySignals } from "@/lib/intelligence/beyond-keywords";
import type { SkillsIntelligence } from "@/lib/intelligence/semantic-matcher";

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
    gpt4o: number;
    claude?: number;
    gemini?: number;
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
    gpt4o: number;
    claude?: number;
    gemini?: number;
  };
  model_details: {
    gpt4o: DimensionModelCell;
    claude?: DimensionModelCell;
    gemini?: DimensionModelCell;
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
  claude?: Record<string, unknown>;
  gemini?: Record<string, unknown>;
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
  | "EXCEPTIONAL MATCH"
  | "STRONG MATCH"
  | "POTENTIAL MATCH"
  | "WEAK MATCH"
  | "NOT A MATCH";

export type RecruiterCard = {
  candidate_header: CandidateHeader;
  what_stands_out: StandoutBullet[];
  worth_exploring: string[];
  interview_questions: string[];
};

export type {
  ResumeQualitySignals,
  OwnershipRatioResult,
  QuantificationScoreResult,
  QuantificationLevel,
  KeywordStuffingResult,
} from "@/lib/intelligence/beyond-keywords";

export type {
  SkillsIntelligence,
  SkillMatchResult,
  SkillMatchType,
} from "@/lib/intelligence/semantic-matcher";

export type CandidateScoreResult = {
  overall_score: number;
  profile_classification?: {
    primary_type: string;
    ai_depth: "native" | "applied" | "peripheral" | "none";
    lean_summary: string;
  } | null;
  /** Shown in UI when must-have deal breakers were missing and score was capped down. */
  deal_breaker_warning?: string | null;
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
    gpt4o: { insufficient: string[] };
    claude?: { risks: string[]; gaps: string[] };
    gemini?: { green_flags: string[]; watch_signals: string[] };
  };
  recruiter_card: RecruiterCard;
  resume_quality_signals: ResumeQualitySignals | null;
  skills_intelligence: SkillsIntelligence | null;
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
  skills: "Technical Skills Match",
  trajectory: "Career Growth Pattern",
  domain: "Industry Experience",
  seniority: "Seniority Level",
  tenure: "Job Stability",
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

export type InterviewQuestion = {
  question: string;
  why_this_question: string;
  probes: string[];
  rubric: {
    exceptional: string;
    strong: string;
    adequate: string;
    weak: string;
  };
  maps_to_dimension: string;
};

export type InterviewBrief = {
  interview_focus: string;
  candidate_context: string;
  questions: InterviewQuestion[];
  red_flags_to_watch: string[];
  sell_points: string[];
  post_interview_verdict_guide: {
    hire_signal: string;
    pass_signal: string;
    borderline_signal: string;
  };
  generated_at?: string;
  role_brief_id?: string;
};
