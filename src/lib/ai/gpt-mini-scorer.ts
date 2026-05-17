import OpenAI from "openai";
import { getApiKey } from "@/lib/ai/api-keys";
import { parseJsonFromModel } from "@/lib/ai/parse-json";
import type { CandidateSignalProfile } from "@/types/candidate";
import type { RoleBrief } from "@/types/role-brief";
import type {
  AttributedFlag,
  CandidateScoreResult,
  DimensionConsensusDetail,
  DimensionKey,
  DimensionScore,
  RecruiterCard,
  StandoutBullet,
} from "@/types/score";
import { DIMENSION_LABELS } from "@/types/score";
import type { ResumeQualitySignals } from "@/lib/intelligence/beyond-keywords";
import { matchRequiredSkills } from "@/lib/intelligence/semantic-matcher";
import {
  CONFIDENCE_LABEL_HIGH,
  CONFIDENCE_LABEL_MEDIUM,
  CONFIDENCE_LABEL_REVIEW,
} from "@/lib/scoring/recruiter-labels";
import {
  filenameToDisplayName,
  quoteExistsInResume,
} from "@/lib/scoring/recruiter-card";
import { normalizeInterviewQuestions } from "@/lib/scoring/interview-questions";

const DIMENSION_KEYS: DimensionKey[] = [
  "skills",
  "trajectory",
  "domain",
  "seniority",
  "tenure",
];

export const GENERIC_GPT_MINI_SYSTEM_PROMPT = `You are a senior recruiting analyst. You assess candidates honestly against job roles. You only claim a signal exists when you can quote the exact resume text that proves it. A skill listed in a skills section means nothing without work description evidence. A skill demonstrated in a work description with a measurable outcome means everything. You assess. You do not encourage. Evidence changes your score. Claims do not.`;

function resolveSystemPrompt(roleBrief: RoleBrief): string {
  const custom = roleBrief.scoring_prompt?.trim();
  return custom || GENERIC_GPT_MINI_SYSTEM_PROMPT;
}

/** Beyond-keyword signals plus profile skill context for the scorer prompt. */
export type CandidateScoringSignals = ResumeQualitySignals & {
  skills_verified: { skill: string; evidence: string }[];
  skills_listed_only: string[];
  ownership_ratio_percent: number;
  quantification_ratio_percent: number;
  profile_depth: "Deep" | "Moderate" | "Surface";
};

type GptVerdictLabel =
  | "strong match"
  | "potential match"
  | "low match"
  | "no match";

type GptConfidence = "high" | "medium" | "low";

type GptDimensionRow = {
  score: number;
  quote: string | null;
  note: string;
};

type GptMustHaveRow = {
  requirement: string;
  status: "found" | "inferred" | "absent";
  quote: string | null;
  note: string;
};

type GptStrengthRow = {
  signal: string;
  quote: string;
  strength: "strong" | "moderate";
};

type GptWatchRow = {
  concern: string;
  basis: string;
};

type GptMiniRawResponse = {
  overall_score?: number;
  verdict?: string;
  confidence?: string;
  confidence_reason?: string;
  dimension_scores?: Record<string, GptDimensionRow>;
  must_haves_check?: GptMustHaveRow[];
  why_this_candidate?: {
    summary?: string;
    strengths?: GptStrengthRow[];
  };
  watch_points?: GptWatchRow[];
  interview_questions?: string[];
};

export function buildScoringSignalsFromProfile(
  profile: CandidateSignalProfile,
): CandidateScoringSignals {
  return {
    ...profile.resume_quality,
    skills_verified: profile.skills_verified ?? [],
    skills_listed_only: profile.skills_listed_only ?? [],
    ownership_ratio_percent: profile.ownership_ratio_percent,
    quantification_ratio_percent: profile.quantification_ratio_percent,
    profile_depth: profileDepthFromProfile(profile),
  };
}

export function profileDepthFromProfile(
  profile: CandidateSignalProfile,
): "Deep" | "Moderate" | "Surface" {
  if (profile.keyword_stuffing_flagged) return "Surface";
  if (
    profile.quantification_level === "sometimes" ||
    profile.quantification_ratio_percent < 45
  ) {
    return "Moderate";
  }
  return "Deep";
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeResumeForMatch(text: string): string {
  return text.replace(/\s+/g, " ").toLowerCase();
}

/** First 20 characters of quote must appear in stripped resume. */
export function quoteVerifiedInResume(
  quote: string | null,
  strippedResume: string,
): boolean {
  if (!quote?.trim()) return false;
  const q = quote.trim();
  const resumeNorm = normalizeResumeForMatch(strippedResume);
  const prefix = normalizeResumeForMatch(q.slice(0, 20));
  if (prefix.length >= 8 && resumeNorm.includes(prefix)) return true;
  return quoteExistsInResume(q, strippedResume);
}

function formatSemanticClusters(roleBrief: RoleBrief): string {
  const entries = Object.entries(roleBrief.semantic_clusters ?? {});
  if (entries.length === 0) return "None listed";
  return entries
    .map(([skill, equivs]) => {
      const eq = (equivs ?? []).filter(Boolean).join(", ");
      return eq ? `${skill}: ${eq}` : skill;
    })
    .join("\n");
}

function buildUserMessage(
  roleBrief: RoleBrief,
  strippedResume: string,
  signals: CandidateScoringSignals,
): string {
  const mustHaves = (roleBrief.deal_breakers ?? []).join("\n- ") || "None listed";
  const keyReqs =
    (roleBrief.core_signals ?? []).map((s) => {
      const eq =
        s.equivalents.length > 0
          ? ` (equivalents: ${s.equivalents.join(", ")})`
          : "";
      return `${s.skill}${eq}`;
    }).join("\n- ") || "None listed";
  const niceToHaves = (roleBrief.preferred_signals ?? []).join("\n- ") || "None listed";

  const verifiedSkills =
    signals.skills_verified.length > 0
      ? signals.skills_verified
          .map((s) => `- ${s.skill}: ${s.evidence}`)
          .join("\n")
      : "None";
  const listedOnly =
    signals.skills_listed_only.length > 0
      ? signals.skills_listed_only.map((s) => `- ${s}`).join("\n")
      : "None";

  return `## Section 1 — Job role
Title: ${roleBrief.title}
Title band: ${roleBrief.title_band ?? "Not specified"}

Must Haves:
- ${mustHaves}

Key Requirements:
- ${keyReqs}

Nice to Haves:
- ${niceToHaves}

Semantic skill clusters (required skill → equivalents):
${formatSemanticClusters(roleBrief)}

## Section 2 — Candidate profile
${strippedResume}

## Section 3 — Beyond-keyword signals
Ownership ratio: ${signals.ownership_ratio_percent}% — label: Takes Ownership
Quantification score: ${signals.quantification_ratio_percent}% — label: Proves Impact
Profile depth: ${signals.profile_depth}
Skills verified in work descriptions:
${verifiedSkills}
Skills listed only:
${listedOnly}

## Section 4 — Scoring rules
Rule one — for every dimension scored above 60 include the exact quote from the resume that justifies it; if no direct quote exists the score must be 60 or below.
Rule two — a skill in a skills section only scores maximum 45; in a work description scores higher; with quantified outcomes scores highest.
Rule three — participation language like part of team assisted contributed scores maximum 55; ownership language like built led designed architected scores higher.
Rule four — every interview question must reference something specific from this candidate's resume; questions that could be asked of any candidate are not acceptable.
Rule five — flag missing must-haves clearly but do not adjust the score for them; surface them and let the recruiter decide.

Return JSON only with this exact schema:
{
  "overall_score": integer,
  "verdict": "strong match" | "potential match" | "low match" | "no match",
  "confidence": "high" | "medium" | "low",
  "confidence_reason": "one sentence",
  "dimension_scores": {
    "skills": { "score": integer, "quote": "exact resume text or null", "note": "one sentence" },
    "trajectory": { "score": integer, "quote": "...", "note": "..." },
    "domain": { "score": integer, "quote": "...", "note": "..." },
    "seniority": { "score": integer, "quote": "...", "note": "..." },
    "tenure": { "score": integer, "quote": "...", "note": "..." }
  },
  "must_haves_check": [
    { "requirement": "string", "status": "found" | "inferred" | "absent", "quote": "string or null", "note": "one sentence" }
  ],
  "why_this_candidate": {
    "summary": "one sentence naming strongest signal and biggest gap for this role",
    "strengths": [
      { "signal": "brief label", "quote": "exact resume text", "strength": "strong" | "moderate" }
    ]
  },
  "watch_points": [
    { "concern": "specific concern", "basis": "what evidence or absence caused this" }
  ],
  "interview_questions": ["question 1", "question 2"]
}`;
}

function parseGptResponse(raw: unknown): GptMiniRawResponse {
  if (typeof raw !== "object" || raw == null) {
    throw new Error("GPT-4o mini returned invalid JSON.");
  }
  return raw as GptMiniRawResponse;
}

function parseDimensionScores(
  raw: GptMiniRawResponse,
): Record<DimensionKey, GptDimensionRow> {
  const out = {} as Record<DimensionKey, GptDimensionRow>;
  const src = raw.dimension_scores ?? {};
  for (const key of DIMENSION_KEYS) {
    const row = src[key];
    if (!row || typeof row.score !== "number") {
      throw new Error(`GPT response missing dimension_scores.${key}`);
    }
    out[key] = {
      score: clampScore(row.score),
      quote: typeof row.quote === "string" ? row.quote : null,
      note: typeof row.note === "string" ? row.note.trim() : "",
    };
  }
  return out;
}

function computeWeightedOverall(
  dimensions: Record<DimensionKey, number>,
  roleBrief: RoleBrief,
): number {
  const weights: Record<DimensionKey, number> = {
    skills: roleBrief.weight_skills,
    trajectory: roleBrief.weight_trajectory,
    domain: roleBrief.weight_domain,
    seniority: roleBrief.weight_seniority,
    tenure: roleBrief.weight_tenure,
  };
  const total = DIMENSION_KEYS.reduce((s, k) => s + weights[k], 0);
  if (total <= 0) return 0;
  const sum = DIMENSION_KEYS.reduce(
    (s, k) => s + dimensions[k] * weights[k],
    0,
  );
  return clampScore(sum / total);
}

function mapConfidence(
  level: GptConfidence,
  reason: string,
): Pick<
  CandidateScoreResult,
  "confidence_level" | "confidence_label" | "review_recommended"
> {
  const label = reason.trim() || "Assessment complete";
  switch (level) {
    case "high":
      return {
        confidence_level: "high",
        confidence_label: CONFIDENCE_LABEL_HIGH,
        review_recommended: false,
      };
    case "low":
      return {
        confidence_level: "low",
        confidence_label: CONFIDENCE_LABEL_REVIEW,
        review_recommended: true,
      };
    default:
      return {
        confidence_level: "medium",
        confidence_label: CONFIDENCE_LABEL_MEDIUM,
        review_recommended: false,
      };
  }
}

function attributed(text: string): AttributedFlag {
  return {
    text: text.trim(),
    sources: ["gpt4o"],
    sourceLabel: "Match analysis",
  };
}

function buildDimensionConsensus(
  validated: Record<DimensionKey, GptDimensionRow>,
): DimensionConsensusDetail[] {
  return DIMENSION_KEYS.map((key) => {
    const row = validated[key];
    const score = row.score;
    return {
      key,
      label: DIMENSION_LABELS[key],
      model_scores: { claude: score, gpt4o: score, gemini: score },
      model_details: {
        gpt4o: {
          score,
          reason: row.note,
          dimension_flag: row.quote ? `Quote: ${row.quote.slice(0, 80)}` : row.note,
        },
        claude: { score, reason: row.note, dimension_flag: "" },
        gemini: { score, reason: row.note, dimension_flag: "" },
      },
      spread: 0,
      agreement: "unanimous" as const,
      dimension_confidence_label: CONFIDENCE_LABEL_HIGH,
      consensus_score: score,
      provisional_score: null,
      rationale: row.note,
    };
  });
}

function buildRecruiterCardFromGpt(
  candidateFilename: string,
  strippedResume: string,
  raw: GptMiniRawResponse,
  signalProfile: CandidateSignalProfile | null,
): RecruiterCard {
  const what_stands_out: StandoutBullet[] = [];
  for (const s of raw.why_this_candidate?.strengths ?? []) {
    if (what_stands_out.length >= 3) break;
    const evidence = s.quote?.trim() ?? "";
    if (!evidence || !quoteExistsInResume(evidence, strippedResume)) continue;
    what_stands_out.push({ signal: s.signal.trim(), evidence });
  }

  const worth_exploring = (raw.watch_points ?? [])
    .map((w) => `${w.concern.trim()} — ${w.basis.trim()}`)
    .filter(Boolean)
    .slice(0, 2);

  let interview_questions = normalizeInterviewQuestions(
    raw.interview_questions ?? [],
  ).slice(0, 2);
  while (interview_questions.length < 2) {
    interview_questions.push(
      "Walk me through a project from your resume where your contribution was hardest to infer from the written profile alone.",
    );
  }

  const header = signalProfile
    ? {
        display_name: signalProfile.display_name || filenameToDisplayName(candidateFilename),
        most_recent_title: signalProfile.most_recent_title || "Not stated",
        total_years_experience: signalProfile.total_years_experience || "Not stated",
        career_pattern: signalProfile.career_pattern || "Not available",
      }
    : {
        display_name: filenameToDisplayName(candidateFilename),
        most_recent_title: "Not stated",
        total_years_experience: "Not stated",
        career_pattern: "Not available",
      };

  return {
    candidate_header: header,
    what_stands_out,
    worth_exploring,
    interview_questions,
  };
}

function mapToCandidateScoreResult(
  strippedResume: string,
  roleBrief: RoleBrief,
  signals: CandidateScoringSignals,
  raw: GptMiniRawResponse,
  validatedDimensions: Record<DimensionKey, GptDimensionRow>,
  overallScore: number,
  candidateFilename: string,
  signalProfile: CandidateSignalProfile | null,
): CandidateScoreResult {
  const skillsIntelligence = matchRequiredSkills(roleBrief, strippedResume);
  const confidenceLevel = (raw.confidence ?? "medium").toLowerCase() as GptConfidence;
  const confidence = mapConfidence(
    confidenceLevel === "high" || confidenceLevel === "low"
      ? confidenceLevel
      : "medium",
    String(raw.confidence_reason ?? ""),
  );

  const dimension_scores = {} as Record<DimensionKey, DimensionScore>;
  for (const key of DIMENSION_KEYS) {
    const row = validatedDimensions[key];
    dimension_scores[key] = {
      score: row.score,
      rationale: row.note,
      agreement: "unanimous",
      model_scores: {
        claude: row.score,
        gpt4o: row.score,
        gemini: row.score,
      },
    };
  }

  const green_flags: AttributedFlag[] = (raw.why_this_candidate?.strengths ?? [])
    .slice(0, 3)
    .map((s) => attributed(s.signal));

  const watch_signals: AttributedFlag[] = (raw.watch_points ?? [])
    .slice(0, 4)
    .map((w) => attributed(w.concern));

  const review_flags: AttributedFlag[] = (raw.must_haves_check ?? [])
    .filter((m) => m.status === "absent")
    .slice(0, 2)
    .map((m) => attributed(`Must-have gap: ${m.requirement} — ${m.note}`));

  const risks: AttributedFlag[] = (raw.must_haves_check ?? [])
    .filter((m) => m.status === "inferred")
    .slice(0, 3)
    .map((m) => attributed(`Inferred only: ${m.requirement}`));

  return {
    overall_score: overallScore,
    deal_breaker_warning: null,
    overall_provisional: false,
    ...confidence,
    dimension_scores,
    dimension_consensus: buildDimensionConsensus(validatedDimensions),
    green_flags,
    watch_signals,
    review_flags,
    risks,
    gaps: review_flags,
    dissent_signals: [],
    model_raw_responses: {
      gpt4o: raw,
      claude: {},
      gemini: {},
    },
    model_flags: {
      claude: { risks: [], gaps: [] },
      gpt4o: { insufficient: [] },
      gemini: {
        green_flags: green_flags.map((f) => f.text),
        watch_signals: watch_signals.map((f) => f.text),
      },
    },
    recruiter_card: buildRecruiterCardFromGpt(
      candidateFilename,
      strippedResume,
      raw,
      signalProfile,
    ),
    resume_quality_signals: signals,
    skills_intelligence: skillsIntelligence,
  };
}

export type ScoreCandidateOptions = {
  candidateFilename?: string;
  signalProfile?: CandidateSignalProfile | null;
};

/**
 * Score a candidate with GPT-4o mini (temperature 0, JSON mode).
 * Resume text must already be PII-stripped.
 */
export async function scoreCandidate(
  strippedResumeText: string,
  roleBrief: RoleBrief,
  beyondKeywordSignals: CandidateScoringSignals,
  options: ScoreCandidateOptions = {},
): Promise<CandidateScoreResult> {
  const stripped = strippedResumeText.trim();
  if (!stripped) {
    throw new Error("Stripped resume text is required for scoring.");
  }

  const client = new OpenAI({ apiKey: getApiKey("openai") });
  const userMessage = buildUserMessage(roleBrief, stripped, beyondKeywordSignals);

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: resolveSystemPrompt(roleBrief) },
      { role: "user", content: userMessage },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? "";
  const parsed = parseGptResponse(parseJsonFromModel(text));
  let dimensions = parseDimensionScores(parsed);

  for (const key of DIMENSION_KEYS) {
    const row = dimensions[key];
    if (row.score > 60 && row.quote && !quoteVerifiedInResume(row.quote, stripped)) {
      dimensions[key] = {
        ...row,
        score: 55,
        note: row.note
          ? `${row.note} Unverified quote.`
          : "Unverified quote.",
      };
    } else if (row.score > 60 && !row.quote) {
      dimensions[key] = {
        ...row,
        score: 55,
        note: row.note
          ? `${row.note} No supporting quote for score above 60.`
          : "No supporting quote for score above 60.",
      };
    }
  }

  const scoreByDim = Object.fromEntries(
    DIMENSION_KEYS.map((k) => [k, dimensions[k].score]),
  ) as Record<DimensionKey, number>;

  const overallScore = computeWeightedOverall(scoreByDim, roleBrief);

  const filename =
    options.candidateFilename?.trim() || "candidate-resume.pdf";

  return mapToCandidateScoreResult(
    stripped,
    roleBrief,
    beyondKeywordSignals,
    parsed,
    dimensions,
    overallScore,
    filename,
    options.signalProfile ?? null,
  );
}
