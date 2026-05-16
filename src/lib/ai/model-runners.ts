import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import type { RoleBrief } from "@/types/role-brief";
import type { DimensionKey } from "@/types/score";
import { formatProviderAuthError, getApiKey } from "./api-keys";
import { buildRoleContext } from "./build-role-context";
import type { ResumeQualitySignals } from "@/lib/intelligence/beyond-keywords";
import { parseJsonFromModel } from "./parse-json";

const DIMENSION_KEYS: DimensionKey[] = [
  "skills",
  "trajectory",
  "domain",
  "seniority",
  "tenure",
];

const SIGNAL_EXTRACTOR_SYSTEM = `You are an expert recruiter with 18 years of enterprise technology hiring experience. Analyse this candidate profile against the role brief. For each of the five dimensions identify the strongest signals both positive and concerning. Base your analysis ONLY on information explicitly stated in the profile. Label any inference clearly. When a RESUME QUALITY SIGNALS block is present, use it to assess signal quality (ownership language, quantification, keyword stuffing). Return structured JSON only.`;

const DEVILS_ADVOCATE_SYSTEM = `You are a rigorous hiring committee member whose job is to identify risks gaps and red flags. What critical information is missing? What patterns suggest risk? What gaps exist between role requirements and demonstrated experience? When a RESUME QUALITY SIGNALS block is present, factor it into risks and gaps. Return structured JSON with a risks array and a gaps array.`;

const STRUCTURED_SCORER_SYSTEM = `Score this candidate against the role brief on each of the five dimensions from 0 to 100. Score only on explicitly stated information. Do not infer. If information is absent score it 0 and flag as insufficient data. When a RESUME QUALITY SIGNALS block is present, use it when assessing signal quality. Return JSON only with dimension name score and one line reason.`;

export type GreenFlagEntry = {
  text: string;
  dimension?: string;
  evidence_quote?: string;
};

export type CandidateProfileFromModel = {
  most_recent_title?: string;
  total_years_experience?: number | string;
  work_history?: { company: string; type: string }[];
  career_pattern?: string;
};

/** Gemini Flash - Signal Extractor */
export type SignalExtractorResult = {
  dimensions: Record<
    DimensionKey,
    {
      score: number;
      positive_signals: string[];
      concerning_signals: string[];
      inference_notes?: string;
    }
  >;
  green_flags: GreenFlagEntry[];
  watch_signals: { text: string; dimension?: string }[];
  candidate_profile?: CandidateProfileFromModel;
};

/** Claude - Devil's Advocate */
export type DevilsAdvocateResult = {
  risks: string[];
  gaps: string[];
  interview_questions: string[];
  dimension_scores: Record<
    DimensionKey,
    { score: number; reason: string }
  >;
};

/** GPT-4o - Structured Scorer */
export type StructuredScorerResult = {
  dimensions: Record<
    DimensionKey,
    { score: number; reason: string; insufficient_data?: boolean }
  >;
};

/** @deprecated use SignalExtractorResult */
export type ClaudeSignals = SignalExtractorResult;
/** @deprecated use DevilsAdvocateResult */
export type GptAdvocate = DevilsAdvocateResult;
/** @deprecated use StructuredScorerResult */
export type GeminiScorer = StructuredScorerResult;

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

async function callSignalExtractorOnce(
  modelId: string,
  roleBrief: RoleBrief,
  resumeText: string,
  resumeQualitySignals: ResumeQualitySignals,
): Promise<{ result: SignalExtractorResult; raw: Record<string, unknown> }> {
  const genAI = new GoogleGenerativeAI(getApiKey("google"));
  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: SIGNAL_EXTRACTOR_SYSTEM,
    generationConfig: { responseMimeType: "application/json" },
  });

  const userContent = `${buildRoleContext(roleBrief, resumeText, resumeQualitySignals)}

Return JSON only with this shape:
{
  "dimensions": {
    "skills": { "score": 0-100, "positive_signals": ["..."], "concerning_signals": ["..."], "inference_notes": "optional" },
    "trajectory": { ... },
    "domain": { ... },
    "seniority": { ... },
    "tenure": { ... }
  },
  "candidate_profile": {
    "most_recent_title": "most recent job title from the resume",
    "total_years_experience": number,
    "work_history": [{ "company": "employer name", "type": "Services" | "Product" | "GCC" | "Startup" }],
    "career_pattern": "optional e.g. Services → GCC → Product"
  },
  "green_flags": [{ "text": "signal statement", "evidence_quote": "exact verbatim quote from the resume supporting this signal", "dimension": "skills" }],
  "watch_signals": [{ "text": "...", "dimension": "skills" }]
}
Provide at most 3 green_flags and at most 3 watch_signals, ranked by relevance to the role brief.
For each green_flag, evidence_quote MUST be an exact substring copied from the candidate profile text — do not paraphrase.
Classify each work_history entry type as exactly one of: Services, Product, GCC, or Startup.`;

  const text = (await model.generateContent(userContent)).response.text();
  const parsed = parseJsonFromModel(text) as Record<string, unknown>;
  return {
    result: parseSignalExtractorResponse(parsed),
    raw: parsed,
  };
}

async function callSignalExtractor(
  roleBrief: RoleBrief,
  resumeText: string,
  resumeQualitySignals: ResumeQualitySignals,
): Promise<{ result: SignalExtractorResult; raw: Record<string, unknown> }> {
  const models = geminiModelCandidates();
  const failures: string[] = [];

  for (const modelId of models) {
    const maxAttempts = 2;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await callSignalExtractorOnce(
          modelId,
          roleBrief,
          resumeText,
          resumeQualitySignals,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (isRetryableGeminiError(message) && attempt < maxAttempts - 1) {
          await sleep(retryDelayMs(message));
          continue;
        }
        failures.push(`${modelId}: ${formatProviderAuthError("google", message)}`);
        break;
      }
    }
  }

  throw new Error(
    failures.length > 0
      ? failures[failures.length - 1]
      : "Gemini (Signal Extractor) failed for all configured models.",
  );
}

async function callDevilsAdvocate(
  roleBrief: RoleBrief,
  resumeText: string,
  resumeQualitySignals: ResumeQualitySignals,
): Promise<{ result: DevilsAdvocateResult; raw: Record<string, unknown> }> {
  const client = new Anthropic({ apiKey: getApiKey("anthropic") });
  const userContent = `${buildRoleContext(roleBrief, resumeText, resumeQualitySignals)}

Return JSON only with this shape (at most 3 risks, 2 gaps, exactly 2 interview_questions):
{
  "risks": ["..."],
  "gaps": ["..."],
  "interview_questions": ["open-ended question probing a specific gap", "..."],
  "dimension_scores": {
    "skills": { "score": 0-100, "reason": "one line" },
    "trajectory": { "score": 0-100, "reason": "one line" },
    "domain": { "score": 0-100, "reason": "one line" },
    "seniority": { "score": 0-100, "reason": "one line" },
    "tenure": { "score": 0-100, "reason": "one line" }
  }
}
dimension_scores should reflect how risks and gaps affect each dimension.
interview_questions must be open questions that probe the specific gaps found — not generic interview questions.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: DEVILS_ADVOCATE_SYSTEM,
    messages: [{ role: "user", content: userContent }],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  const parsed = parseJsonFromModel(text) as Record<string, unknown>;
  return {
    result: parseDevilsAdvocateResponse(parsed),
    raw: parsed,
  };
}

async function callStructuredScorer(
  roleBrief: RoleBrief,
  resumeText: string,
  resumeQualitySignals: ResumeQualitySignals,
): Promise<{ result: StructuredScorerResult; raw: Record<string, unknown> }> {
  const client = new OpenAI({ apiKey: getApiKey("openai") });
  const userContent = `${buildRoleContext(roleBrief, resumeText, resumeQualitySignals)}

Return JSON only:
{
  "dimensions": {
    "skills": { "score": 0-100, "reason": "one line", "insufficient_data": false },
    "trajectory": { ... },
    "domain": { ... },
    "seniority": { ... },
    "tenure": { ... }
  }
}`;

  const completion = await client.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: STRUCTURED_SCORER_SYSTEM },
      { role: "user", content: userContent },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? "";
  const parsed = parseJsonFromModel(text) as Record<string, unknown>;
  return {
    result: parseStructuredScorerResponse(parsed),
    raw: parsed,
  };
}

const DEFAULT_GEMINI_MODELS = [
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
];

function geminiModelCandidates(): string[] {
  const preferred = process.env.GEMINI_MODEL?.trim();
  if (preferred) {
    return [preferred, ...DEFAULT_GEMINI_MODELS.filter((m) => m !== preferred)];
  }
  return DEFAULT_GEMINI_MODELS;
}

function isRetryableGeminiError(message: string): boolean {
  return (
    message.includes("429") ||
    message.includes("Too Many Requests") ||
    message.includes("quota") ||
    message.includes("RESOURCE_EXHAUSTED")
  );
}

function retryDelayMs(message: string): number {
  const match = message.match(/retry in (\d+(?:\.\d+)?)s/i);
  if (match) {
    return Math.ceil(parseFloat(match[1]) * 1000) + 500;
  }
  return 3000;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function parseSignalExtractorResponse(
  parsed: Record<string, unknown>,
): SignalExtractorResult {
  const dimensions = {} as SignalExtractorResult["dimensions"];

  for (const key of DIMENSION_KEYS) {
    const dim = (parsed.dimensions as Record<string, unknown>)?.[key] as
      | Record<string, unknown>
      | undefined;
    if (!dim || typeof dim.score !== "number") {
      throw new Error(`Gemini (Signal Extractor) response missing dimension: ${key}`);
    }
    dimensions[key] = {
      score: clampScore(dim.score),
      positive_signals: stringArray(dim.positive_signals),
      concerning_signals: stringArray(dim.concerning_signals),
      inference_notes:
        typeof dim.inference_notes === "string" ? dim.inference_notes : undefined,
    };
  }

  const candidate_profile = parseCandidateProfile(parsed.candidate_profile);

  return {
    dimensions,
    green_flags: greenFlagArray(parsed.green_flags).slice(0, 3),
    watch_signals: flagArray(parsed.watch_signals).slice(0, 3),
    candidate_profile,
  };
}

function parseDevilsAdvocateResponse(
  parsed: Record<string, unknown>,
): DevilsAdvocateResult {
  const dimension_scores = {} as DevilsAdvocateResult["dimension_scores"];

  for (const key of DIMENSION_KEYS) {
    const dim = (parsed.dimension_scores as Record<string, unknown>)?.[key] as
      | Record<string, unknown>
      | undefined;
    if (!dim || typeof dim.score !== "number") {
      throw new Error(
        `Claude (Devil's Advocate) response missing dimension_scores.${key}`,
      );
    }
    dimension_scores[key] = {
      score: clampScore(dim.score),
      reason: typeof dim.reason === "string" ? dim.reason.trim() : "",
    };
  }

  return {
    risks: stringArray(parsed.risks).slice(0, 3),
    gaps: stringArray(parsed.gaps).slice(0, 2),
    interview_questions: stringArray(parsed.interview_questions).slice(0, 2),
    dimension_scores,
  };
}

function parseStructuredScorerResponse(
  parsed: Record<string, unknown>,
): StructuredScorerResult {
  const dimensions = {} as StructuredScorerResult["dimensions"];

  for (const key of DIMENSION_KEYS) {
    const dim = (parsed.dimensions as Record<string, unknown>)?.[key] as
      | Record<string, unknown>
      | undefined;
    if (!dim || typeof dim.score !== "number") {
      throw new Error(`GPT-4o (Structured Scorer) response missing dimension: ${key}`);
    }
    dimensions[key] = {
      score: clampScore(dim.score),
      reason: typeof dim.reason === "string" ? dim.reason.trim() : "",
      insufficient_data: Boolean(dim.insufficient_data),
    };
  }

  return { dimensions };
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

function flagArray(value: unknown): { text: string; dimension?: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return { text: item.trim() };
      if (typeof item === "object" && item !== null && "text" in item) {
        const o = item as { text: unknown; dimension?: unknown };
        return {
          text: String(o.text).trim(),
          dimension:
            typeof o.dimension === "string" ? o.dimension : undefined,
        };
      }
      return null;
    })
    .filter((x): x is { text: string; dimension?: string } => !!x?.text);
}

function greenFlagArray(value: unknown): GreenFlagEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return { text: item.trim() };
      if (typeof item === "object" && item !== null && "text" in item) {
        const o = item as {
          text: unknown;
          dimension?: unknown;
          evidence_quote?: unknown;
        };
        const text = String(o.text).trim();
        if (!text) return null;
        return {
          text,
          dimension:
            typeof o.dimension === "string" ? o.dimension : undefined,
          evidence_quote:
            typeof o.evidence_quote === "string"
              ? o.evidence_quote.trim()
              : undefined,
        };
      }
      return null;
    })
    .filter((x): x is GreenFlagEntry => !!x?.text);
}

function parseCandidateProfile(
  value: unknown,
): CandidateProfileFromModel | undefined {
  if (typeof value !== "object" || value == null) return undefined;
  const o = value as Record<string, unknown>;
  return {
    most_recent_title:
      typeof o.most_recent_title === "string" ? o.most_recent_title : undefined,
    total_years_experience:
      typeof o.total_years_experience === "number" ||
      typeof o.total_years_experience === "string"
        ? o.total_years_experience
        : undefined,
    work_history: Array.isArray(o.work_history)
      ? (o.work_history as { company: string; type: string }[])
      : undefined,
    career_pattern:
      typeof o.career_pattern === "string" ? o.career_pattern : undefined,
  };
}

export type ModelRunResults = {
  claude: DevilsAdvocateResult;
  gpt: StructuredScorerResult;
  gemini: SignalExtractorResult;
  raw_responses: {
    claude: unknown;
    gpt4o: unknown;
    gemini: unknown;
  };
};

function fallbackDevilsAdvocate(errorMsg: string): DevilsAdvocateResult {
  return {
    risks: [`Claude scoring model unavailable: ${errorMsg || "unknown error"}`],
    gaps: [],
    interview_questions: [],
    dimension_scores: Object.fromEntries(
      DIMENSION_KEYS.map((k) => [k, { score: 0, reason: "Model unavailable - review recommended" }]),
    ) as DevilsAdvocateResult["dimension_scores"],
  };
}

function fallbackSignalExtractor(errorMsg: string): SignalExtractorResult {
  return {
    dimensions: Object.fromEntries(
      DIMENSION_KEYS.map((k) => [
        k,
        { score: 0, positive_signals: [], concerning_signals: [], inference_notes: "Model unavailable - review recommended" },
      ]),
    ) as unknown as SignalExtractorResult["dimensions"],
    green_flags: [],
    watch_signals: [{ text: `Gemini scoring model unavailable: ${errorMsg || "unknown error"}` }],
  };
}

function fallbackStructuredScorer(): StructuredScorerResult {
  return {
    dimensions: Object.fromEntries(
      DIMENSION_KEYS.map((k) => [k, { score: 0, reason: "Model unavailable - review recommended", insufficient_data: true }]),
    ) as StructuredScorerResult["dimensions"],
  };
}

export async function runAllModelsParallel(
  roleBrief: RoleBrief,
  resumeText: string,
  resumeQualitySignals: ResumeQualitySignals,
): Promise<ModelRunResults> {
  const [claudeSettled, geminiSettled, gptSettled] = await Promise.allSettled([
    callDevilsAdvocate(roleBrief, resumeText, resumeQualitySignals),
    callSignalExtractor(roleBrief, resumeText, resumeQualitySignals),
    callStructuredScorer(roleBrief, resumeText, resumeQualitySignals),
  ]);

  const labels = [
    "Claude (Devil's Advocate)",
    "Gemini Flash (Signal Extractor)",
    "GPT-4o (Structured Scorer)",
  ];
  const providers: ("anthropic" | "openai" | "google")[] = [
    "anthropic",
    "google",
    "openai",
  ];
  const settled = [claudeSettled, geminiSettled, gptSettled];

  const errorMessages = settled.map((r, i) => {
    if (r.status === "rejected") {
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      return formatProviderAuthError(providers[i], msg);
    }
    return null;
  });

  if (errorMessages.every((m) => m !== null)) {
    throw new Error(
      errorMessages.map((m, i) => `${labels[i]}: ${m}`).join("\n"),
    );
  }

  errorMessages.forEach((msg, i) => {
    if (msg) {
      console.error(`[model-runners] ${labels[i]} failed, using fallback:`, msg);
    }
  });

  const claudeRun =
    claudeSettled.status === "fulfilled"
      ? claudeSettled.value
      : { result: fallbackDevilsAdvocate(errorMessages[0] ?? ""), raw: {} };

  const geminiRun =
    geminiSettled.status === "fulfilled"
      ? geminiSettled.value
      : { result: fallbackSignalExtractor(errorMessages[1] ?? ""), raw: {} };

  const gptRun =
    gptSettled.status === "fulfilled"
      ? gptSettled.value
      : { result: fallbackStructuredScorer(), raw: {} };

  return {
    claude: claudeRun.result,
    gpt: gptRun.result,
    gemini: geminiRun.result,
    raw_responses: {
      claude: claudeRun.raw,
      gpt4o: gptRun.raw,
      gemini: geminiRun.raw,
    },
  };
}
