import type {
  CandidateScoringStatus,
  CandidateSource,
} from "@/types/job";
import type { CoreStrengthBreakdown } from "@/lib/intelligence/skill-domains";
import type { GithubProfileData } from "@/lib/candidates/github-enrichment";
import type { CompanyType, FitVerdict, ResumeQualitySignals } from "@/types/score";
import type { CandidateScoreResult } from "@/types/score";

export type CandidateStage =
  | "new"
  | "screening"
  | "pipeline"
  | "passed"
  | "hired";

export type TrajectoryVelocity = "fast" | "normal" | "slow";

export type SignalRating = "Strong" | "Moderate" | "Weak";

export type VerifiedSkill = {
  skill: string;
  evidence: string;
};

export type ProfileSignal = {
  signal: string;
  evidence: string;
};

export type ExperienceEntry = {
  title: string;
  company: string;
  company_type: CompanyType;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  bullets: string[];
};

export type EducationEntry = {
  institution: string;
  degree: string | null;
  field: string | null;
  year: string | null;
};

export type CandidateSignalProfile = {
  display_name: string;
  first_name: string;
  last_name: string;
  current_title: string | null;
  most_recent_title: string;
  current_company: string | null;
  location: string | null;
  total_years_experience: string;
  linkedin_url: string | null;
  portfolio_links: string[];
  career_pattern: string;
  career_types_sequence: CompanyType[];
  shows_product_progression: boolean;
  professional_summary: string;
  resume_quality: ResumeQualitySignals;
  ownership_ratio_percent: number;
  quantification_ratio_percent: number;
  quantification_level: "consistent" | "sometimes" | "rarely";
  keyword_stuffing_flagged: boolean;
  keyword_stuffing_explanation: string;
  trajectory_velocity: TrajectoryVelocity;
  positive_signals: ProfileSignal[];
  watch_signals: string[];
  experience: ExperienceEntry[];
  experience_fallback_raw: string | null;
  education: EducationEntry[];
  skills_verified: VerifiedSkill[];
  skills_listed_only: string[];
  title_band: string | null;
  core_strength_primary: string | null;
  core_strength_secondary: string | null;
  core_strength_breakdown: CoreStrengthBreakdown;
  github?: GithubProfileData | null;
  resume_content_hash?: string | null;
};

export type CandidateActivityType =
  | "added"
  | "scored"
  | "tagged"
  | "note_added"
  | "stage_changed"
  | "screened"
  | "passed"
  | "saved_to_pipeline";

export type CandidateActivity = {
  id: string;
  type: CandidateActivityType;
  summary: string;
  created_at: string;
  meta?: Record<string, string | number | null>;
};

export type CandidateNote = {
  id: string;
  candidate_id: string;
  body: string;
  created_at: string;
};

export type CandidateRow = {
  id: string;
  display_name: string;
  current_title: string | null;
  current_company: string | null;
  resume_filename: string | null;
  resume_file_path: string | null;
  resume_file_name: string | null;
  resume_file_size: number | null;
  resume_file_type: string | null;
  resume_stored_at: string | null;
  resume_delete_after: string | null;
  resume_text: string;
  signal_profile: CandidateSignalProfile;
  stage: CandidateStage;
  tag: string | null;
  activity: CandidateActivity[];
  job_id: string | null;
  source: CandidateSource;
  application_email: string | null;
  application_phone: string | null;
  application_location: string | null;
  applied_at: string | null;
  scoring_status: CandidateScoringStatus;
  linkedin_url: string | null;
  created_at: string;
  updated_at: string;
};

export type CandidateRoleFitScore = {
  id: string;
  role_brief_id: string | null;
  role_brief_title: string | null;
  overall_score: number;
  verdict: FitVerdict;
  created_at: string;
  score_snapshot: CandidateScoreResult | null;
  role_brief_snapshot: unknown;
};

export type CandidateScoreSummary = {
  id: string;
  role_brief_id: string | null;
  role_brief_title: string | null;
  overall_score: number;
  verdict: FitVerdict;
};

export type CandidatePoolFilter = "all" | "scored" | "unscored";

export type CandidateListItem = Omit<CandidateRow, "resume_text"> & {
  resume_text?: string;
  role_scores: CandidateScoreSummary[];
  highest_score: number;
};

export type CandidateDetail = CandidateRow & {
  notes: CandidateNote[];
  role_fit_scores: CandidateRoleFitScore[];
};

export type CandidateVerdictFilter =
  | "all"
  | "strong"
  | "possible"
  | "weak"
  | "not_suitable"
  | "unscored";

export type CandidateCompanyTypeFilter = "all" | CompanyType;

export type CandidateExperienceFilter =
  | "all"
  | "0-3"
  | "4-7"
  | "8-12"
  | "13+";

export type CandidateSortOption =
  | "recent"
  | "oldest"
  | "highest_score"
  | "name_az"
  | "most_scored";

export type CandidateCoreStrengthFilter =
  | "all"
  | "backend"
  | "frontend"
  | "data_ml"
  | "devops_infra"
  | "ai_llm";

export type CandidateSourceFilter =
  | "all"
  | "uploaded"
  | "linkedin_profile"
  | "application";
