import {
  buildScoringSignalsFromProfile,
  scoreCandidate,
  type ScoreObservabilityContext,
} from "@/lib/ai/gpt-mini-scorer";
import { logScoreSuccess } from "@/lib/observability/log-event";
import { resolveObservabilityIds } from "@/lib/observability/resolve-context";
import { createActivity, prependActivity } from "@/lib/candidates/activity";
import { trackEvent } from "@/lib/analytics/track";
import { recordRecruiterDecision } from "@/lib/decisions/recruiter-decisions";
import { scoringStatusFromOverall } from "@/lib/jobs/scoring-status";
import { computeBriefContentHash } from "@/lib/role-brief/jd-cache";
import { stripPII } from "@/lib/resume/strip-pii";
import { buildSavedScoreInsertPayload } from "@/lib/saved-scores/build-save-payload";
import { insertSavedScoreWithFallback } from "@/lib/saved-scores/insert-with-fallback";
import {
  recomputeOverallFromSnapshot,
  recomputeVerdict,
} from "@/lib/scoring/recompute-from-snapshot";
import { computeConfidence } from "@/lib/scoring/compute-confidence";
import { filenameToDisplayName, scoreToVerdict } from "@/lib/scoring/recruiter-card";
import { getCandidateById, updateCandidate } from "@/lib/supabase/candidates";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { parseRoleBriefRow } from "@/types/role-brief";
import type { CandidateScoreResult, FitVerdict } from "@/types/score";

export type ExecuteCandidateScoreResult = {
  result: CandidateScoreResult;
  savedScoreId: string;
  fromCache: boolean;
  verdict: FitVerdict;
};

function applyProfileToRecruiterCard(
  result: CandidateScoreResult,
  candidate: NonNullable<Awaited<ReturnType<typeof getCandidateById>>>,
  filename: string,
): void {
  result.recruiter_card.candidate_header.display_name =
    candidate.display_name || filenameToDisplayName(filename);
  const profile = candidate.signal_profile;
  if (!profile) return;
  result.recruiter_card.candidate_header.most_recent_title =
    profile.most_recent_title ||
    result.recruiter_card.candidate_header.most_recent_title;
  result.recruiter_card.candidate_header.total_years_experience =
    profile.total_years_experience ||
    result.recruiter_card.candidate_header.total_years_experience;
  result.recruiter_card.candidate_header.career_pattern =
    profile.career_pattern ||
    result.recruiter_card.candidate_header.career_pattern;
}

function resolveScoringText(resumeText: string): string {
  const { stripped } = stripPII(resumeText);
  const rawText = resumeText.trim();
  let scoringText = stripped.trim();
  if (scoringText.length < 80 && rawText.length >= 80) {
    scoringText = rawText;
  }
  return scoringText;
}

/** Score a candidate for a role (cache-aware). Used by API route and direct auto-eval. */
export async function executeCandidateScore(
  candidateId: string,
  roleBriefId: string,
  options?: { recordDecision?: boolean },
): Promise<ExecuteCandidateScoreResult> {
  try {
    return await executeCandidateScoreInner(candidateId, roleBriefId, options);
  } catch (err) {
    console.error(
      "[score-failed]",
      JSON.stringify({
        candidateId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
    throw err;
  }
}

async function executeCandidateScoreInner(
  candidateId: string,
  roleBriefId: string,
  options?: { recordDecision?: boolean },
): Promise<ExecuteCandidateScoreResult> {
  const recordDecision = options?.recordDecision !== false;

  const candidate = await getCandidateById(candidateId);
  if (!candidate) {
    throw new Error("Candidate not found");
  }

  const supabase = await createSupabaseServerClient();
  const { data: briefRow, error: briefError } = await supabase
    .from("role_briefs")
    .select("*")
    .eq("id", roleBriefId)
    .single();

  if (briefError || !briefRow) {
    throw new Error("Role brief not found");
  }

  const roleBrief = parseRoleBriefRow(briefRow as Record<string, unknown>);
  const filename =
    candidate.resume_filename ?? `${candidate.display_name}.pdf`;
  const currentHash = computeBriefContentHash(roleBrief);

  const cacheQuery = await supabase
    .from("saved_scores")
    .select("id, overall_score, score_snapshot, brief_content_hash")
    .eq("candidate_id", candidateId)
    .eq("role_brief_id", roleBriefId)
    .order("created_at", { ascending: false })
    .limit(20);

  const cacheRow =
    !cacheQuery.error && cacheQuery.data
      ? (cacheQuery.data as Array<Record<string, unknown>>).find(
          (row) => row.brief_content_hash === currentHash,
        )
      : null;

  if (cacheRow?.score_snapshot) {
    const snapshot = cacheRow.score_snapshot as CandidateScoreResult;
    const dims = snapshot.dimension_scores as unknown as Record<
      string,
      { score: number }
    >;
    if (dims) {
      const recomputed = recomputeOverallFromSnapshot(dims, roleBrief);
      const recomputedVerdict = recomputeVerdict(recomputed);
      const cachedResult: CandidateScoreResult = {
        ...snapshot,
        overall_score: recomputed,
      };

      if (Number(cacheRow.overall_score) !== recomputed) {
        await supabase
          .from("saved_scores")
          .update({ overall_score: recomputed })
          .eq("id", String(cacheRow.id));
      }

      await updateCandidate(candidateId, {
        scoring_status: scoringStatusFromOverall(recomputed),
        job_id: candidate.job_id ?? roleBriefId,
      });

      void trackEvent("candidate_scored", {
        candidate_id: candidateId,
        job_id: roleBriefId,
        score: recomputed,
        verdict: recomputedVerdict,
        from_cache: true,
      });

      void (async () => {
        const recruiterId = candidate.created_by ?? undefined;
        const obs = recruiterId
          ? await resolveObservabilityIds(recruiterId)
          : {};
        logScoreSuccess({
          candidateId,
          jobId: roleBriefId,
          durationMs: 0,
          model: "gpt-4o-mini-2024-07-18",
          cacheHit: true,
          workspaceId: obs.workspaceId,
          recruiterId: obs.recruiterId,
        });
      })();

      const scoringStatus = scoringStatusFromOverall(recomputed);
      console.log(
        "[score-complete]",
        JSON.stringify({
          candidateId,
          verdict: recomputedVerdict,
          overallScore: recomputed,
          scoringStatus,
        }),
      );

      return {
        result: cachedResult,
        savedScoreId: String(cacheRow.id),
        fromCache: true,
        verdict: recomputedVerdict,
      };
    }
  }

  const scoringText = resolveScoringText(candidate.resume_text ?? "");
  if (!scoringText) {
    throw new Error(
      "Resume text is empty — re-upload the resume or run Reparse in admin.",
    );
  }

  const signals = buildScoringSignalsFromProfile(candidate.signal_profile);
  const recruiterId = candidate.created_by ?? undefined;
  const obsIds = recruiterId
    ? await resolveObservabilityIds(recruiterId)
    : {};
  const scoreObs: ScoreObservabilityContext = {
    candidateId,
    jobId: roleBriefId,
    workspaceId: obsIds.workspaceId,
    recruiterId: obsIds.recruiterId,
  };
  const result = await scoreCandidate(
    scoringText,
    roleBrief,
    signals,
    candidate.signal_profile?.github,
    scoreObs,
  );
  applyProfileToRecruiterCard(result, candidate, filename);
  result.confidence = computeConfidence(candidate.signal_profile, result);

  const savePayload = {
    ...buildSavedScoreInsertPayload(filename, roleBrief, result, "", ""),
    candidate_id: candidateId,
  };

  const { id: savedScoreId } = await insertSavedScoreWithFallback(
    savePayload as unknown as Record<string, unknown>,
  );

  const activity = prependActivity(
    candidate.activity,
    createActivity("scored", `Scored against ${roleBrief.title}`, {
      role_brief_id: roleBrief.id,
      score: result.overall_score,
    }),
  );

  await updateCandidate(candidateId, {
    activity,
    scoring_status: scoringStatusFromOverall(result.overall_score),
    job_id: candidate.job_id ?? roleBriefId,
  });

  if (recordDecision) {
    await recordRecruiterDecision({
      candidateId,
      jobId: roleBrief.id,
      decisionType: "scored",
      reasonCategory: scoreToVerdict(result.overall_score),
      reasonDetail: String(result.overall_score),
      candidateProfile: candidate.signal_profile,
      roleBrief,
    });
  }

  const verdict = scoreToVerdict(result.overall_score);
  void trackEvent("candidate_scored", {
    candidate_id: candidateId,
    job_id: roleBriefId,
    score: result.overall_score,
    verdict,
  });

  const scoringStatus = scoringStatusFromOverall(result.overall_score);
  console.log(
    "[score-complete]",
    JSON.stringify({
      candidateId,
      verdict,
      overallScore: result.overall_score,
      scoringStatus,
    }),
  );

  return { result, savedScoreId, fromCache: false, verdict };
}
