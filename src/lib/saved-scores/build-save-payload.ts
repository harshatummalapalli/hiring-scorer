import { computeBriefContentHash } from "@/lib/role-brief/jd-cache";
import { estimatedScoreCostUsd } from "@/lib/scoring/cost";
import { ensureIntegerOverallScore } from "@/lib/saved-scores/normalize-score";
import type { CandidateScoreResult } from "@/types/score";
import { DEFAULT_SCORING_WEIGHTS, type RoleBrief } from "@/types/role-brief";
import type { RoleBriefSnapshot } from "@/types/saved-score";

function minimalRoleBrief(
  partial: Pick<RoleBrief, "id" | "title"> &
    Partial<
      Pick<
        RoleBrief,
        | "weight_skills"
        | "weight_trajectory"
        | "weight_domain"
        | "weight_seniority"
        | "weight_tenure"
        | "created_at"
      >
    >,
): RoleBrief {
  return {
    ...partial,
    job_location: null,
    seniority_override: null,
    department: null,
    client_company_name: null,
    client_company_brief: null,
    client_company_size: null,
    client_company_website: null,
    job_description: null,
    job_description_hash: null,
    analysis_version: 1,
    last_analysed_at: null,
    deal_breakers: [],
    core_signals: [],
    preferred_signals: [],
    cannot_assess: [],
    equivalent_titles: [],
    title_band: null,
    semantic_clusters: {},
    weight_skills: partial.weight_skills ?? DEFAULT_SCORING_WEIGHTS.weight_skills,
    weight_trajectory:
      partial.weight_trajectory ?? DEFAULT_SCORING_WEIGHTS.weight_trajectory,
    weight_domain: partial.weight_domain ?? DEFAULT_SCORING_WEIGHTS.weight_domain,
    weight_seniority:
      partial.weight_seniority ?? DEFAULT_SCORING_WEIGHTS.weight_seniority,
    weight_tenure: partial.weight_tenure ?? DEFAULT_SCORING_WEIGHTS.weight_tenure,
    application_token: null,
    apply_link: null,
    company_name: null,
    application_active: true,
    application_count: 0,
    auto_score_mode: "needs_scoring",
    status: "active",
    inbound_email: null,
    inbound_email_active: false,
    created_by: null,
    created_at: partial.created_at ?? "",
  };
}

export function roleBriefToSnapshot(brief: RoleBrief): RoleBriefSnapshot {
  return {
    id: brief.id,
    title: brief.title,
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
    return minimalRoleBrief({
      id: snapshot.id,
      title: snapshot.title,
      weight_skills: snapshot.weight_skills,
      weight_trajectory: snapshot.weight_trajectory,
      weight_domain: snapshot.weight_domain,
      weight_seniority: snapshot.weight_seniority,
      weight_tenure: snapshot.weight_tenure,
    });
  }
  return minimalRoleBrief({
    id: fallbackId ?? "",
    title: fallbackTitle ?? "Unknown role",
  });
}

export function buildSavedScoreInsertPayload(
  candidateFilename: string,
  roleBrief: RoleBrief,
  result: CandidateScoreResult,
  tag: string,
  recruiterNotes: string,
) {
  const overall_score = Math.round(
    Number(ensureIntegerOverallScore(result, roleBrief)),
  );
  const role_brief_snapshot = roleBriefToSnapshot(roleBrief);

  return {
    candidate_filename: candidateFilename,
    role_brief_id: roleBrief.id,
    role_brief_title: roleBrief.title,
    overall_score: Number.isFinite(overall_score) ? overall_score : 0,
    confidence_level: result.confidence_label,
    dimension_scores: result.dimension_scores,
    green_flags: result.green_flags,
    watch_signals: result.watch_signals,
    review_flags: result.review_flags,
    tag: tag.trim() || null,
    recruiter_notes: recruiterNotes.trim() || null,
    score_snapshot: { ...result, overall_score },
    role_brief_snapshot,
    scoring_prompt_version: 1,
    scoring_cost_usd: estimatedScoreCostUsd(),
    model_used: "gpt-4o-mini",
    brief_content_hash: computeBriefContentHash(roleBrief),
  };
}
