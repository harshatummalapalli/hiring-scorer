import { getCandidateById } from "@/lib/supabase/candidates";
import {
  getPipelineEntry,
  insertPipelineCandidate,
} from "@/lib/supabase/pipeline";
import { extractContactFromResume } from "@/lib/pipeline/extract-contact";
import {
  insightsFromProfile,
  insightsFromScoreResult,
} from "@/lib/pipeline/insights-from-score";
import { scoreToVerdict } from "@/lib/scoring/recruiter-card";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import type { CandidateScoreResult } from "@/types/score";
import type { PipelineCandidateRow } from "@/types/pipeline";
import { getCandidateHeaderName } from "@/lib/candidates/profile-display";

async function loadScoreForRole(
  candidateId: string,
  roleBriefId: string,
): Promise<{
  overall_score: number;
  verdict: string;
  score_snapshot: CandidateScoreResult | null;
} | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("saved_scores")
    .select("overall_score, score_snapshot")
    .eq("candidate_id", candidateId)
    .eq("role_brief_id", roleBriefId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const score = Number(data.overall_score ?? 0);
  return {
    overall_score: score,
    verdict: scoreToVerdict(score),
    score_snapshot: (data.score_snapshot as CandidateScoreResult) ?? null,
  };
}

/** Latest score for this candidate on any role (talent-pool adds). */
async function loadLatestScoreAnyRole(
  candidateId: string,
): Promise<{
  overall_score: number;
  verdict: string;
  score_snapshot: CandidateScoreResult | null;
} | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("saved_scores")
    .select("overall_score, score_snapshot")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  const score = Number(data.overall_score ?? 0);
  return {
    overall_score: score,
    verdict: scoreToVerdict(score),
    score_snapshot: (data.score_snapshot as CandidateScoreResult) ?? null,
  };
}

function buildAutoRecruiterSummary(
  name: string,
  score: { overall_score: number; verdict: string; score_snapshot: CandidateScoreResult | null } | null,
  profile: {
    current_title?: string | null;
    total_years_experience?: string | null;
    core_strength_primary?: string | null;
    core_strength_secondary?: string | null;
    top_skills?: string[] | null;
    skills?: string[] | null;
  },
): string | null {
  if (!score?.score_snapshot) return null;

  const snap = score.score_snapshot as CandidateScoreResult & {
    why_this_candidate?: {
      summary?: string;
      strengths?: Array<{ signal?: string; supporting_quote?: string | null }>;
      watch_points?: Array<{ concern?: string; evidence_basis?: string }>;
    };
    green_flags?: Array<{ text?: string }>;
    watch_signals?: Array<{ text?: string }>;
    recruiter_card?: {
      worth_exploring?: string[];
    };
  };

  // Fix verdict capitalisation: "POTENTIAL_MATCH" → "Potential Match"
  const verdictLabel = score.verdict
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const scoreNum = Math.round(score.overall_score);

  // --- Opening sentence ---
  const exp = profile.total_years_experience?.trim() ?? null;
  const domain =
    profile.core_strength_primary?.trim() ??
    profile.current_title?.trim() ??
    null;

  const skills: string[] = (
    profile.top_skills ??
    profile.skills ??
    []
  ).slice(0, 5);

  const skillPhrase = skills.length > 0 ? skills.join(", ") : null;

  let openingSentence = `${name} is a ${verdictLabel} (${scoreNum}/100).`;
  if (exp && domain && skillPhrase) {
    openingSentence = `${name} has ${exp} of experience in ${domain} with strong emphasis on ${skillPhrase}.`;
  } else if (exp && domain) {
    openingSentence = `${name} has ${exp} of experience in ${domain}.`;
  } else if (exp && skillPhrase) {
    openingSentence = `${name} has ${exp} of experience with strong emphasis on ${skillPhrase}.`;
  }

  const lines: string[] = [];
  lines.push(openingSentence);

  // --- Scoring insights (strengths / AI summary) ---
  const aiSummary = snap.why_this_candidate?.summary?.trim() ?? null;
  const strengths = snap.why_this_candidate?.strengths ?? [];
  const greenFlags = snap.green_flags ?? [];

  const insightLines: string[] = [];
  if (aiSummary) insightLines.push(aiSummary);

  for (const s of strengths) {
    const text = s.signal?.trim();
    if (text && !insightLines.includes(text)) insightLines.push(text);
    if (insightLines.length >= 3) break;
  }

  if (insightLines.length < 2) {
    for (const g of greenFlags) {
      const text = g.text?.trim();
      if (text && !insightLines.includes(text)) insightLines.push(text);
      if (insightLines.length >= 3) break;
    }
  }

  if (insightLines.length > 0) {
    lines.push("");
    for (const line of insightLines.slice(0, 3)) {
      lines.push(`• ${line}`);
    }
  }

  // --- Watch points (2–3) ---
  const watchPoints: string[] = [];

  for (const w of snap.why_this_candidate?.watch_points ?? []) {
    const concern = w.concern?.trim();
    if (concern) watchPoints.push(concern);
    if (watchPoints.length >= 3) break;
  }

  if (watchPoints.length < 2) {
    for (const w of snap.watch_signals ?? []) {
      const text = w.text?.trim();
      if (text && !watchPoints.includes(text)) watchPoints.push(text);
      if (watchPoints.length >= 3) break;
    }
  }

  if (watchPoints.length < 2 && snap.recruiter_card?.worth_exploring) {
    for (const w of snap.recruiter_card.worth_exploring) {
      const text = w.trim();
      if (text && !watchPoints.includes(text)) watchPoints.push(text);
      if (watchPoints.length >= 3) break;
    }
  }

  if (watchPoints.length > 0) {
    lines.push("");
    lines.push("Watch points:");
    for (const w of watchPoints) {
      lines.push(`• ${w}`);
    }
  }

  return lines.join("\n");
}

export async function addCandidateToPipeline(
  candidateId: string,
  roleBriefId: string,
  shortlistReason: string | null = null,
): Promise<{ row: PipelineCandidateRow; created: boolean }> {
  const existing = await getPipelineEntry(roleBriefId, candidateId);
  if (existing) return { row: existing, created: false };

  const candidate = await getCandidateById(candidateId);
  if (!candidate) {
    throw new Error("Candidate not found.");
  }

  const scoreForRole = await loadScoreForRole(candidateId, roleBriefId);
  const score =
    scoreForRole ?? (await loadLatestScoreAnyRole(candidateId));
  const profile = candidate.signal_profile;
  const contact = extractContactFromResume(candidate.resume_text, profile);

  const insights = score?.score_snapshot
    ? insightsFromScoreResult(score.score_snapshot)
    : insightsFromProfile(profile);

  const fit_score =
    score?.overall_score ??
    candidate.role_fit_scores.find((f) => f.role_brief_id === roleBriefId)
      ?.overall_score ??
    candidate.role_fit_scores[0]?.overall_score ??
    null;

  const fit_verdict =
    score?.verdict ??
    (fit_score != null ? scoreToVerdict(fit_score) : null);

  const displayName = getCandidateHeaderName(profile);
  const autoNotes = buildAutoRecruiterSummary(displayName, score, {
    current_title: profile.current_title,
    total_years_experience: profile.total_years_experience,
    core_strength_primary: profile.core_strength_primary,
    core_strength_secondary: profile.core_strength_secondary,
    top_skills: (profile as { top_skills?: string[] | null }).top_skills,
    skills: profile.skills_listed_only?.length
      ? profile.skills_listed_only
      : profile.skills_verified?.map((s) => s.skill),
  });

  const row = await insertPipelineCandidate({
    role_brief_id: roleBriefId,
    candidate_id: candidateId,
    candidate_name: displayName,
    email: contact.email ?? profile.extracted_email ?? null,
    phone: contact.phone ?? profile.extracted_phone ?? null,
    location: profile.location,
    fit_score: fit_score != null ? Math.round(fit_score) : null,
    fit_verdict,
    insights,
    shortlist_reason: shortlistReason,
    recruiter_notes: autoNotes,
  });

  return { row, created: true };
}
