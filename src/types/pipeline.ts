import type { FitVerdict } from "@/types/score";
import type { TitleBand } from "@/types/role-brief";

export type PipelineInsights = {
  signals: string[];
};

export type PipelineCandidateRow = {
  id: string;
  role_brief_id: string;
  candidate_id: string;
  candidate_name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  fit_score: number | null;
  fit_verdict: FitVerdict | string | null;
  insights: PipelineInsights;
  relocation: string | null;
  present_salary: string | null;
  expected_salary: string | null;
  recruiter_notes: string | null;
  custom_fields: Record<string, string>;
  added_at: string;
  created_by: string | null;
};

export type PipelineRoleSection = {
  role_brief_id: string;
  title: string;
  title_band: TitleBand | null;
  candidates: PipelineCandidateRow[];
};

export type ScoredCandidateOption = {
  candidate_id: string;
  candidate_name: string;
  overall_score: number;
  verdict: FitVerdict;
  saved_score_id: string;
  already_in_pipeline: boolean;
};
