import Anthropic from "@anthropic-ai/sdk";
import { getApiKey } from "@/lib/ai/api-keys";
import type { RoleBriefAnalysis } from "@/types/role-brief";

const SCORING_PROMPT_ENGINEER_SYSTEM = `You are Karta's scoring prompt engineer. Generate a custom scoring prompt for GPT-4o Mini based on this job role analysis. The prompt you generate will be used by GPT-4o Mini to score every candidate against this specific role. Write it to compensate for GPT-4o Mini's limitations — be extremely explicit, use concrete examples, leave no ambiguity. Return only the prompt text with no preamble or explanation.`;

function buildScoringPromptUserMessage(
  analysis: RoleBriefAnalysis,
  jobDescription: string,
): string {
  return `Generate a custom GPT-4o Mini scoring prompt for this job role.

The prompt must include all of the following sections (use clear headings):

1. Role-specific assessor persona — someone expert at evaluating candidates for exactly this type of role, with specific knowledge of what this role requires and what candidates in this field commonly overstate.

2. Scoring calibration — what resume evidence looks like at score levels 90, 75, 60, 45, and 30 for this specific role type, with concrete example phrases a candidate might write at each level.

3. Must-have verification rules — for each must-have requirement below, describe what counts as direct evidence, what counts as semantic inference with a score cap of 60, and what specific phrases to look for.

4. Contrastive reasoning triggers — list three to five claims candidates for this role type commonly overstate, with the specific challenge question GPT should ask internally before accepting each claim.

5. Forbidden phrases list — inference language that is not acceptable for scores above 60 for this role type.

Structured role brief (JSON from JD analysis):
${JSON.stringify(analysis, null, 2)}

Raw job description:
${jobDescription.trim()}`;
}

/**
 * Second Claude call: role-tailored system prompt for GPT-4o Mini candidate scoring.
 */
export async function generateRoleScoringPrompt(
  analysis: RoleBriefAnalysis,
  jobDescription: string,
): Promise<string> {
  const client = new Anthropic({ apiKey: getApiKey("anthropic") });

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: SCORING_PROMPT_ENGINEER_SYSTEM,
    messages: [
      {
        role: "user",
        content: buildScoringPromptUserMessage(analysis, jobDescription),
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text for scoring prompt generation.");
  }

  const prompt = textBlock.text.trim();
  if (!prompt) {
    throw new Error("Claude returned an empty scoring prompt.");
  }
  return prompt;
}
