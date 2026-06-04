import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getGeminiModel } from "@/lib/ai/api-keys";

export type ResumeParsingStats = {
  parserLabel: string;
  candidatesParsedThisMonth: number;
  parseFailuresThisMonth: number;
  monthUtc: string;
};

function startOfUtcMonthIso(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

function geminiDisplayLabel(modelId: string): string {
  if (modelId.includes("2.5-flash")) return "Gemini 2.5 Flash";
  if (modelId.includes("flash")) return "Gemini Flash";
  return modelId;
}

export async function fetchResumeParsingStats(): Promise<ResumeParsingStats> {
  const admin = createSupabaseAdminClient();
  const monthStart = startOfUtcMonthIso();
  const monthUtc = monthStart.slice(0, 7);

  const { count: parsedCount, error: parsedError } = await admin
    .from("candidates")
    .select("*", { count: "exact", head: true })
    .gte("created_at", monthStart);

  if (parsedError) throw new Error(parsedError.message);

  let parseFailures = 0;
  const { count: failCount, error: failError } = await admin
    .from("candidates")
    .select("*", { count: "exact", head: true })
    .eq("parsing_status", "failed")
    .gte("created_at", monthStart);

  if (!failError) {
    parseFailures = failCount ?? 0;
  } else if (
    !failError.message.includes("parsing_status") &&
    !failError.message.includes("column")
  ) {
    throw new Error(failError.message);
  }

  return {
    parserLabel: geminiDisplayLabel(getGeminiModel()),
    candidatesParsedThisMonth: parsedCount ?? 0,
    parseFailuresThisMonth: parseFailures,
    monthUtc,
  };
}
