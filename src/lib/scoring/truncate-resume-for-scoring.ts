/** Max verbatim resume chars sent to GPT (quote verification uses full stripped text). */
export const SCORING_RESUME_CHAR_LIMIT = 10_000;

/**
 * Keeps the opening portion of the resume where recent roles usually appear.
 * Returns the full text when under the limit.
 */
export function truncateResumeForScoring(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= SCORING_RESUME_CHAR_LIMIT) return trimmed;
  return trimmed.slice(0, SCORING_RESUME_CHAR_LIMIT);
}

export function resumeWasTruncatedForScoring(text: string): boolean {
  return text.trim().length > SCORING_RESUME_CHAR_LIMIT;
}
