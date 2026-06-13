import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { updateCandidate } from "@/lib/supabase/candidates";
import { executeCandidateScore } from "@/lib/scoring/execute-candidate-score";
import { runCronAutoEvaluation } from "@/lib/scoring/run-cron-auto-evaluation";

async function setScoringStatus(
  candidateId: string,
  scoringStatus: string,
  ownerUserId?: string,
): Promise<void> {
  if (ownerUserId) {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("candidates")
      .update({
        scoring_status: scoringStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", candidateId);
    if (error) throw new Error(error.message);
    return;
  }
  await updateCandidate(candidateId, { scoring_status: scoringStatus });
}

/**
 * Runs evaluation for a candidate on a role.
 * Pass ownerUserId for fire-and-forget paths (upload/reparse) so scoring
 * does not depend on the original request cookie context.
 */
export async function triggerAutoEvaluation(
  candidateId: string,
  roleBriefId: string,
  ownerUserId?: string,
): Promise<void> {
  try {
    await setScoringStatus(candidateId, "evaluating", ownerUserId);

    if (ownerUserId) {
      const supabase = createSupabaseAdminClient();
      await runCronAutoEvaluation(
        supabase,
        candidateId,
        roleBriefId,
        ownerUserId,
      );
      return;
    }

    await executeCandidateScore(candidateId, roleBriefId);
  } catch (err) {
    console.error(
      `[auto-eval] Evaluation failed for ${candidateId}:`,
      err instanceof Error ? err.message : err,
    );
    try {
      await setScoringStatus(candidateId, "needs_scoring", ownerUserId);
    } catch (statusErr) {
      console.error(
        `[auto-eval] Failed to mark ${candidateId} needs_scoring:`,
        statusErr instanceof Error ? statusErr.message : statusErr,
      );
    }
  }
}
