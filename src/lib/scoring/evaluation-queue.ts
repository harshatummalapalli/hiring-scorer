import { executeCandidateScore } from "@/lib/scoring/execute-candidate-score";

/**
 * Runs evaluation for a candidate on a role (direct — no HTTP self-loop).
 */
export async function triggerAutoEvaluation(
  candidateId: string,
  roleBriefId: string,
): Promise<void> {
  try {
    await executeCandidateScore(candidateId, roleBriefId);
  } catch (err) {
    console.error(
      `[auto-eval] Evaluation failed for ${candidateId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
