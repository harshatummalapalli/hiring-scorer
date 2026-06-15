// Prices per 1M tokens, in USD. Manual updates when providers change pricing.
// Current as of June 2026.
export const MODEL_PRICING = {
  "gemini-2.5-flash": {
    input: 0.075,
    output: 0.3,
  },
  "gpt-4o-mini-2024-07-18": {
    input: 0.15,
    output: 0.6,
  },
  "claude-sonnet-4-6": {
    input: 3.0,
    output: 15.0,
  },
} as const;

export function computeCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[model as keyof typeof MODEL_PRICING];
  if (!pricing) return 0;

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  return Number((inputCost + outputCost).toFixed(6));
}
