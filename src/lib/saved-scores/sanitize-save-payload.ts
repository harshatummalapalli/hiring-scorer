import { snapshotToRoleBrief } from "@/lib/saved-scores/build-save-payload";
import {
  ensureIntegerOverallScore,
  normalizeStoredOverallScore,
} from "@/lib/saved-scores/normalize-score";
import type { CandidateScoreResult } from "@/types/score";
import type { RoleBriefSnapshot } from "@/types/saved-score";

/** Coerce API/client payload so overall_score is always an integer before Supabase insert. */
export function sanitizeSavedScorePayload(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const snapshot = body.score_snapshot as CandidateScoreResult | undefined;
  const dimension_scores =
    (body.dimension_scores as CandidateScoreResult["dimension_scores"] | undefined) ??
    snapshot?.dimension_scores;
  const role_brief_snapshot = body.role_brief_snapshot as
    | RoleBriefSnapshot
    | undefined
    | null;

  const roleBrief = snapshotToRoleBrief(
    role_brief_snapshot ?? undefined,
    (body.role_brief_title as string) ?? null,
    (body.role_brief_id as string) ?? null,
  );

  let overall_score = normalizeStoredOverallScore(
    body.overall_score ?? snapshot?.overall_score,
    dimension_scores ?? null,
  );

  if (
    (body.overall_score == null || body.overall_score === "") &&
    snapshot
  ) {
    overall_score = ensureIntegerOverallScore(
      { ...snapshot, dimension_scores: dimension_scores ?? snapshot.dimension_scores },
      roleBrief,
    );
  }

  const score_snapshot = snapshot
    ? { ...snapshot, overall_score, dimension_scores: dimension_scores ?? snapshot.dimension_scores }
    : body.score_snapshot;

  return {
    ...body,
    overall_score,
    dimension_scores: dimension_scores ?? body.dimension_scores,
    score_snapshot,
  };
}
