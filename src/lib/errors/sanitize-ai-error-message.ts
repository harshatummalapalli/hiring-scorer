const AI_VENDOR_RE =
  /\b(?:gemini|gpt-?4|openai|claude|anthropic)\b/i;

/** Strip third-party model/provider names from strings shown in the UI. */
export function sanitizeAiErrorMessage(message: string): string {
  const m = message.trim();
  if (!m) return m;

  if (
    /gemini|resource_exhausted/i.test(m) &&
    /(?:rate|quota|429|busy|exhausted|too many)/i.test(m)
  ) {
    return "Resume analysis is busy. Retrying automatically...";
  }

  if (
    /(?:openai|gpt)/i.test(m) &&
    /(?:rate|quota|429|busy|exhausted|too many)/i.test(m)
  ) {
    return "Scoring service is busy. Wait a moment and try again.";
  }

  if (!AI_VENDOR_RE.test(m)) return m;

  if (
    /(?:API_KEY|ADMIN_KEY|_KEY is missing|invalid x-api-key|authentication)/i.test(
      m,
    )
  ) {
    return "A required service credential is not configured. Contact your administrator.";
  }

  if (/invalid json|parser|parsing|resume/i.test(m)) {
    return "Resume analysis failed. Please try again.";
  }

  if (/scor|evaluat|match/i.test(m)) {
    return "Scoring service temporarily unavailable. Please try again.";
  }

  if (/brief|analys|role/i.test(m)) {
    return "Analysis service temporarily unavailable. Please try again.";
  }

  return "Something went wrong. Please try again.";
}
