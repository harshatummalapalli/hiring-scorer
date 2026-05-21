// DEPRECATED: GPT profile extraction was removed to prevent PII from being
// sent to OpenAI. All extraction now happens in the Python parser service
// via RESUME_PARSER_URL. This file is kept for reference only.

import OpenAI from "openai";
import { formatProviderAuthError, getApiKey } from "@/lib/ai/api-keys";
import type { CandidateSignalProfile } from "@/types/candidate";
import {
  EXTRACTION_PROMPT,
  mapParsedProfileToSignal,
  parseProfileJson,
} from "./profile-extraction-shared";

function gptModelCandidates(): string[] {
  const preferred =
    process.env.OPENAI_PROFILE_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim();
  const defaults = ["gpt-4o-mini", "gpt-4o"];
  if (!preferred) return defaults;
  return [preferred, ...defaults.filter((m) => m !== preferred)];
}

function isAuthOrKeyError(message: string): boolean {
  return /API key|API_KEY|401|403|invalid.*key|permission denied|incorrect api key/i.test(
    message,
  );
}

function isQuotaOrRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|quota|rate limit|insufficient_quota/i.test(msg);
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function gptExtractProfile(
  rawResumeText: string,
): Promise<CandidateSignalProfile> {
  const apiKey = getApiKey("openai");
  const client = new OpenAI({ apiKey });
  const failures: { model: string; error: string; quota: boolean }[] = [];

  for (const modelId of gptModelCandidates()) {
    try {
      console.log(`[gpt-profile] Trying model: ${modelId}`);
      const completion = await client.chat.completions.create({
        model: modelId,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          {
            role: "user",
            content: `Extract the structured profile from this resume:\n\n${rawResumeText.slice(0, 15000)}`,
          },
        ],
      });

      const text = completion.choices[0]?.message?.content ?? "";
      const parsed = parseProfileJson(text, "GPT", modelId);
      console.log(`[gpt-profile] Success with model: ${modelId}`);
      return mapParsedProfileToSignal(parsed);
    } catch (err) {
      const msg = formatProviderAuthError("openai", errorMessage(err));
      const quota = isQuotaOrRateLimit(err);
      failures.push({ model: modelId, error: msg, quota });
      console.error(
        `[gpt-profile] ${modelId} failed${quota ? " (quota/rate limit)" : ""}:`,
        msg,
      );
      if (isAuthOrKeyError(msg)) {
        break;
      }
    }
  }

  if (failures.length > 0 && failures.every((f) => f.quota)) {
    throw new Error(
      "OpenAI quota or rate limit exceeded — check billing at https://platform.openai.com",
    );
  }

  const last = failures[failures.length - 1];
  throw new Error(
    last?.error ?? "GPT profile extraction failed for all models",
  );
}

/** @deprecated Use gptExtractProfile */
export const geminiExtractProfile = gptExtractProfile;
