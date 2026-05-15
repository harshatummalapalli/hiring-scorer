import { ensureIntegerOverallScore } from "@/lib/saved-scores/normalize-score";
import type { CandidateScoreResult } from "@/types/score";
import type { RoleBrief } from "@/types/role-brief";
import type { RoleBriefSnapshot } from "@/types/saved-score";

export function roleBriefToSnapshot(brief: RoleBrief): RoleBriefSnapshot {
  return {
    id: brief.id,
    title: brief.title,
    department: brief.department,
    weight_skills: brief.weight_skills,
    weight_trajectory: brief.weight_trajectory,
    weight_domain: brief.weight_domain,
    weight_seniority: brief.weight_seniority,
    weight_tenure: brief.weight_tenure,
  };
}

export function snapshotToRoleBrief(
  snapshot: RoleBriefSnapshot | null | undefined,
  fallbackTitle: string | null,
  fallbackId: string | null,
): RoleBrief {
  if (snapshot) {
    return {
      id: snapshot.id,
      title: snapshot.title,
      department: snapshot.department ?? null,
      responsibilities: null,
      required_skills: null,
      nice_to_have_skills: null,
      experience_years: null,
      weight_skills: snapshot.weight_skills,
      weight_trajectory: snapshot.weight_trajectory,
      weight_domain: snapshot.weight_domain,
      weight_seniority: snapshot.weight_seniority,
      weight_tenure: snapshot.weight_tenure,
      created_at: "",
    };
  }
  return {
    id: fallbackId ?? "",
    title: fallbackTitle ?? "Unknown role",
    department: null,
    responsibilities: null,
    required_skills: null,
    nice_to_have_skills: null,
    experience_years: null,
    weight_skills: 5,
    weight_trajectory: 5,
    weight_domain: 5,
    weight_seniority: 5,
    weight_tenure: 5,
    created_at: "",
  };
}

export function buildSavedScoreInsertPayload(
  candidateFilename: string,
  roleBrief: RoleBrief,
  result: CandidateScoreResult,
  tag: string,
  recruiterNotes: string,
) {
  const overall_score = ensureIntegerOverallScore(result, roleBrief);
  const role_brief_snapshot = roleBriefToSnapshot(roleBrief);

  return {
    candidate_filename: candidateFilename,
    role_brief_id: roleBrief.id,
    role_brief_title: roleBrief.title,
    overall_score,
    confidence_level: result.confidence_label,
    dimension_scores: result.dimension_scores,
    green_flags: result.green_flags,
    watch_signals: result.watch_signals,
    review_flags: result.review_flags,
    tag: tag.trim() || null,
    recruiter_notes: recruiterNotes.trim() || null,
    score_snapshot: { ...result, overall_score },
    role_brief_snapshot,
  };
}
