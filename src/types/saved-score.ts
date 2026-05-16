import type { CandidateScoreResult, DimensionKey, DimensionScore } from "@/types/score";
import type { AttributedFlag } from "@/types/score";

export type RoleBriefSnapshot = {
  id: string;
  title: string;
  weight_skills: number;
  weight_trajectory: number;
  weight_domain: number;
  weight_seniority: number;
  weight_tenure: number;
};

export type SavedScoreRow = {
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
  score_snapshot: CandidateScoreResult | null;
  role_brief_snapshot: RoleBriefSnapshot | null;
  created_at: string;
};

export type SavedScoreSort = "score-desc" | "score-asc" | "date-desc" | "date-asc";
