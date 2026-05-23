function stripCodeFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonSlice(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

function formatParseError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes("Unterminated") ||
    msg.includes("Unexpected end of JSON") ||
    msg.includes("Expected ','") ||
    msg.includes("after JSON")
  ) {
    return new Error(
      "The AI response was incomplete or malformed (common with very long job descriptions). " +
        "Please click Read JD again. If it persists, shorten the JD or split out boilerplate text.",
    );
  }
  return new Error(`Could not parse analysis response: ${msg}`);
}

export function parseJsonFromModel(rawText: string): unknown {
  const cleaned = stripCodeFences(rawText);

  const attempts = [cleaned, extractJsonSlice(cleaned)].filter(
    (s): s is string => Boolean(s?.length),
  );

  let lastError: unknown;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (err) {
      lastError = err;
    }
  }

  throw formatParseError(lastError);
}
