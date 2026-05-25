/**
 * Backward-compat only — used when reconstructing CandidateScoreResult from
 * pre-snapshot saved_scores rows (multi-model era). Live scoring uses gpt-mini-scorer only.
 */

/** Max dimension score spread treated as unanimous agreement (legacy 3-model scores). */
export const AGREEMENT_THRESHOLD = 15;
