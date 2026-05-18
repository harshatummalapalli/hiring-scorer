import OpenAI from "openai";
import { getApiKey } from "@/lib/ai/api-keys";
import { parseJsonFromModel } from "@/lib/ai/parse-json";
import type { BeyondKeywordSignals } from "@/lib/intelligence/beyond-keywords";
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
import type { CandidateSignalProfile } from "@/types/candidate";
import type { RoleBrief, TitleBand } from "@/types/role-brief";
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

const SYSTEM_PROMPT = `You are a senior recruiting analyst with 18 years of experience hiring for engineering, product, and business roles at product companies. You assess candidates with rigorous honesty. Your reputation is built on two things: you only claim a signal exists when you can quote the exact text from the resume that proves it, and you distinguish between candidates who did things versus candidates who watched things happen. You never reward keyword stuffing. A skill listed in a skills section without appearing in a work description is worth almost nothing to you. A skill demonstrated with a quantified outcome in a work description is the strongest signal you know. You assess. You do not encourage. Evidence changes your score. Claims without evidence do not.`;

const DIMENSION_KEYS: DimensionKey[] = [
  "skills",
  "trajectory",
  "domain",
  "seniority",
  "tenure",
];

const TITLE_BAND_DESCRIPTIONS: Record<TitleBand, string> = {
  Entry:
    "Early-career scope: executes defined tasks with guidance; limited ownership of architecture or team outcomes.",
  Mid: "Independent contributor: owns features end-to-end; partners across functions; growing scope without org-wide leadership.",
  Senior:
    "Experienced IC or lead: owns complex systems or domains; mentors others; drives decisions with limited oversight.",
  Staff:
    "Org-level impact: sets technical direction across teams; solves ambiguous problems; influences roadmap beyond one squad.",
  Principal:
    "Company-wide technical leadership: defines strategy; multi-year bets; recognized authority across the organization.",
};

type GptConfidence = "high" | "medium" | "low";

type GptDimensionRow = {
  score: number;
  supporting_quote: string | null;
  assessment_note: string;
};

type GptMustHaveRow = {
  requirement: string;
  status: "found" | "inferred" | "absent";
  supporting_quote: string | null;
  confidence: GptConfidence;
};

type GptStrengthRow = {
  signal: string;
  supporting_quote: string;
  strength_level: "strong" | "moderate";
};

type GptWatchRow = {
  concern: string;
  evidence_basis: string;
};

type GptMiniRawResponse = {
  overall_score?: number;
  verdict?: string;
  confidence?: string;
  confidence_reason?: string;
  dimension_scores?: Record<string, GptDimensionRow>;
  must_haves_check?: GptMustHaveRow[];
  contradictions?: string[];
  why_this_candidate?: {
    summary?: string;
    strengths?: GptStrengthRow[];
    watch_points?: GptWatchRow[];
  };
  interview_questions?: string[];
};

const SCORING_ANCHORS_SECTION = `SCORING ANCHORS:
Use these bands to calibrate each dimension — assign the score that best matches the evidence, not a vague impression.

Skills:
0–20: No evidence of this skill anywhere in the resume.
21–40: Skill appears only in a skills section with no work context.
41–60: Skill appears in work descriptions but without quantified outcomes or ownership language.
61–80: Skill demonstrated in work descriptions with clear individual ownership and some measurable context.
81–100: Deep repeated demonstrated ownership of this skill across multiple roles with quantified measurable impact.

Trajectory:
0–20: No clear progression visible.
21–40: Lateral movement only, no advancement.
41–60: Standard progression at expected pace for years of experience.
61–80: Faster than typical progression with clear scope expansion between roles.
81–100: Exceptional velocity with demonstrated scope growth, promotions, and increasing responsibility that outpaces typical market.

Domain:
0–20: No domain overlap.
21–40: Adjacent domain with no direct relevance.
41–60: Partial domain overlap — some relevant experience.
61–80: Strong domain alignment with direct experience in the required area.
81–100: Deep domain expertise with demonstrated impact in exactly this space.

Seniority:
0–20: Significantly below required level.
21–40: One full level below required.
41–60: Approaching required level but not there.
61–80: Matches required level based on title and demonstrated scope.
81–100: Matches or exceeds required level with evidence of scope beyond the title.

Tenure:
0–20: Consistent pattern of less than 12 months per role with no explanation.
21–40: Multiple short stints suggesting instability.
41–60: Mixed tenure with some concern.
61–80: Generally stable with reasonable transitions.
81–100: Strong tenure showing commitment and seeing work through to completion.`;

const CONTRADICTION_CHECKS_SECTION = `CONTRADICTION CHECKS:
Before finalising scores, check the following. List any implausibilities or inconsistencies in the contradictions array (empty array if none).

Check one — scope plausibility: Does the claimed scope of work match the likely size and stage of the companies listed? If a candidate claims to have led a team of 50 at a company that had 30 employees total, flag this as implausible.

Check two — timeline coherence: Do the dates add up? Are there unexplained gaps longer than 6 months? Do promotion timelines make sense given the roles claimed?

Check three — metric realism: Are quantified outcomes suspiciously round or generic (e.g. improved efficiency by 50 percent with no context)? Flag metrics that lack specificity as lower-confidence evidence.`;

const CONFIDENCE_DERIVATION_SECTION = `CONFIDENCE (evidence-derived, not estimated):
Derive confidence from verified evidence only. If the contradictions array is non-empty, confidence must be medium or low — never high.
High confidence requires: three or more supporting quotes verified in the resume, no contradictions found, consistent chronology, and owned skills appearing in multiple roles.
Medium confidence requires: one or two supporting quotes, no major contradictions, or minor chronology questions.
Low confidence requires: fewer than two verifiable quotes, contradictions present, sparse resume, or significant ambiguity about individual contribution.`;

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

export function buildScoringSignalsFromProfile(
  profile: CandidateSignalProfile,
): BeyondKeywordSignals {
  return {
    ownership: profile.resume_quality.ownership,
    quantification: profile.resume_quality.quantification,
    keyword_stuffing: profile.resume_quality.keyword_stuffing,
    skills_verified: profile.skills_verified ?? [],
    skills_listed_only: profile.skills_listed_only ?? [],
    ownership_ratio_percent: profile.ownership_ratio_percent,
    quantification_ratio_percent: profile.quantification_ratio_percent,
    profile_depth: profileDepthFromProfile(profile),
  };
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeResumeForMatch(text: string): string {
  return text.replace(/\s+/g, " ").toLowerCase();
}

/** First 20 characters of quote must appear in stripped resume (case-insensitive). */
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

function numberedList(items: string[]): string {
  if (items.length === 0) return "1. None listed";
  return items.map((item, i) => `${i + 1}. ${item}`).join("\n");
}

function titleBandDescription(band: TitleBand | null): string {
  if (!band) {
    return "Title band not specified — infer seniority expectations from the job title and must-haves.";
  }
  return TITLE_BAND_DESCRIPTIONS[band];
}

function buildGithubPromptBlock(
  github: NonNullable<CandidateSignalProfile["github"]>,
): string {
  const starred = github.most_starred_repo
    ? `${github.most_starred_repo.name} (${github.most_starred_repo.stars} stars)`
    : "None";
  return `Verified GitHub Activity:
Username: ${github.username}
Public repos: ${github.public_repos}
Account active (pushed within 90 days): ${github.is_active ? "yes" : "no"}
Top languages: ${github.top_languages.join(", ") || "None"}
Most starred project: ${starred}`;
}

function buildUserMessage(
  roleBrief: RoleBrief,
  strippedResume: string,
  signals: BeyondKeywordSignals,
  github?: CandidateSignalProfile["github"] | null,
): string {
  const titleLine = `${roleBrief.title}${roleBrief.title_band ? ` · ${roleBrief.title_band}` : ""}`;

  const mustHaves = numberedList(roleBrief.deal_breakers ?? []);
  const keyRequirements = numberedList(
    (roleBrief.core_signals ?? []).map((s) => {
      const eq =
        s.equivalents.length > 0
          ? ` (${s.equivalents.join(", ")})`
          : "";
      return `${s.skill}${eq}`;
    }),
  );
  const niceToHaves = numberedList(roleBrief.preferred_signals ?? []);

  const verifiedList =
    signals.skills_verified.length > 0
      ? signals.skills_verified.map((s) => s.skill).join(", ")
      : "None";
  const listedOnlyList =
    signals.skills_listed_only.length > 0
      ? signals.skills_listed_only.join(", ")
      : "None";

  return `ROLE:
${titleLine}

Must Haves:
${mustHaves}

Key Requirements:
${keyRequirements}

Nice to Haves:
${niceToHaves}

Title band (${roleBrief.title_band ?? "unspecified"}): ${titleBandDescription(roleBrief.title_band)}

CANDIDATE PROFILE:
${strippedResume}

INDEPENDENT SIGNALS — PRE-CALCULATED:
Ownership drive: ${signals.ownership_ratio_percent}% — measures first-person active language versus participation language in work descriptions.
Impact evidence: ${signals.quantification_ratio_percent}% — measures quantified outcomes versus vague claims in work descriptions.
Profile depth: ${signals.profile_depth} — whether skills are demonstrated in work descriptions (Deep) versus listed only (Surface).
Verified skills (in work descriptions): ${verifiedList}
Listed-only skills (skills section only): ${listedOnlyList}
${github ? `\n${buildGithubPromptBlock(github)}\n` : ""}
SCORING INSTRUCTIONS:
Rule one — before assigning any dimension score above 60 you must find and include the exact quote from the resume that justifies that score. If you cannot find a direct quote the score must be 60 or below.
Rule two — skills appearing only in a skills section score maximum 45 for the skills dimension. Skills appearing in work descriptions score higher. Skills appearing in work descriptions with quantified outcomes score highest.
Rule three — participation language such as part of the team, assisted, supported, contributed to, or helped with scores maximum 55 for relevant dimensions. Ownership language such as built, designed, led, architected, launched, established, or drove scores higher.
Rule four — every interview question must reference specific content from this candidate's resume. A question that could be asked of any candidate for this role is not acceptable. Each question must be unanswerable without knowing this specific candidate's background.
Rule five — missing must-haves are surfaced as warnings but do not automatically cap the score. Surface them clearly and let the recruiter decide.

${SCORING_ANCHORS_SECTION}

${CONTRADICTION_CHECKS_SECTION}

${CONFIDENCE_DERIVATION_SECTION}

OUTPUT FORMAT:
Return this exact JSON schema with no preamble and no text outside the JSON:
{
  "overall_score": integer 0-100,
  "verdict": "strong_match" | "potential_match" | "low_match" | "no_match",
  "confidence": "high" | "medium" | "low",
  "confidence_reason": "one sentence explaining confidence from evidence (quote count, contradictions, chronology)",
  "dimension_scores": {
    "skills": { "score": integer, "supporting_quote": "exact resume text or null", "assessment_note": "one sentence" },
    "trajectory": { "score": integer, "supporting_quote": "...", "assessment_note": "..." },
    "domain": { "score": integer, "supporting_quote": "...", "assessment_note": "..." },
    "seniority": { "score": integer, "supporting_quote": "...", "assessment_note": "..." },
    "tenure": { "score": integer, "supporting_quote": "...", "assessment_note": "..." }
  },
  "must_haves_check": [
    { "requirement": "exact must-have text", "status": "found" | "inferred" | "absent", "supporting_quote": "exact resume text or null", "confidence": "high" | "medium" | "low" }
  ],
  "contradictions": ["string describing each implausibility or inconsistency found, or empty array"],
  "why_this_candidate": {
    "summary": "one sentence naming strongest signal and biggest gap",
    "strengths": [
      { "signal": "label", "supporting_quote": "exact resume text", "strength_level": "strong" | "moderate" }
    ],
    "watch_points": [
      { "concern": "specific concern", "evidence_basis": "what evidence or absence caused this" }
    ]
  },
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
      supporting_quote:
        typeof row.supporting_quote === "string" ? row.supporting_quote : null,
      assessment_note:
        typeof row.assessment_note === "string"
          ? row.assessment_note.trim()
          : "",
    };
  }
  return out;
}

function validateDimensionQuotes(
  dimensions: Record<DimensionKey, GptDimensionRow>,
  strippedResume: string,
): Record<DimensionKey, GptDimensionRow> {
  const validated = { ...dimensions };
  for (const key of DIMENSION_KEYS) {
    const row = validated[key];
    if (row.score <= 60) continue;

    const quoteOk =
      row.supporting_quote &&
      quoteVerifiedInResume(row.supporting_quote, strippedResume);

    if (!quoteOk) {
      validated[key] = {
        ...row,
        score: 55,
        assessment_note: row.assessment_note
          ? `${row.assessment_note} unverified quote`
          : "unverified quote",
      };
    }
  }
  return validated;
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

function parseContradictions(raw: GptMiniRawResponse): string[] {
  if (!Array.isArray(raw.contradictions)) return [];
  return raw.contradictions
    .map((c) => (typeof c === "string" ? c.trim() : ""))
    .filter(Boolean);
}

function countVerifiedDimensionQuotes(
  dimensions: Record<DimensionKey, GptDimensionRow>,
  strippedResume: string,
): number {
  const seen = new Set<string>();
  for (const key of DIMENSION_KEYS) {
    const quote = dimensions[key].supporting_quote;
    if (!quote?.trim() || !quoteVerifiedInResume(quote, strippedResume)) continue;
    seen.add(normalizeResumeForMatch(quote.slice(0, 40)));
  }
  return seen.size;
}

function parseGptConfidence(raw: string | undefined): GptConfidence {
  const level = (raw ?? "medium").toLowerCase();
  if (level === "high" || level === "low") return level;
  return "medium";
}

/** Enforce evidence-based confidence; cap high when contradictions exist. */
function resolveConfidence(
  raw: GptMiniRawResponse,
  validatedDimensions: Record<DimensionKey, GptDimensionRow>,
  strippedResume: string,
): { level: GptConfidence; reason: string } {
  const contradictions = parseContradictions(raw);
  const verifiedQuotes = countVerifiedDimensionQuotes(
    validatedDimensions,
    strippedResume,
  );
  let level = parseGptConfidence(raw.confidence);
  let reason = String(raw.confidence_reason ?? "").trim();

  if (contradictions.length > 0) {
    if (level === "high") {
      level = "medium";
      reason = reason
        ? `${reason} Contradictions flagged — confidence capped at medium.`
        : "Contradictions flagged — confidence capped at medium.";
    }
    if (verifiedQuotes < 2) {
      level = "low";
      reason =
        reason ||
        "Contradictions present with fewer than two verifiable resume quotes.";
    }
  } else if (verifiedQuotes >= 3) {
    if (level === "low") {
      level = "medium";
    }
  } else if (verifiedQuotes >= 1) {
    if (level === "high") {
      level = "medium";
      reason =
        reason ||
        "Only one or two verifiable supporting quotes — medium confidence.";
    }
  } else {
    level = "low";
    reason = reason || "Fewer than two verifiable resume quotes.";
  }

  return { level, reason };
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
          reason: row.assessment_note,
          dimension_flag: row.supporting_quote
            ? `Quote: ${row.supporting_quote.slice(0, 80)}`
            : row.assessment_note,
        },
        claude: { score, reason: row.assessment_note, dimension_flag: "" },
        gemini: { score, reason: row.assessment_note, dimension_flag: "" },
      },
      spread: 0,
      agreement: "unanimous" as const,
      dimension_confidence_label: CONFIDENCE_LABEL_HIGH,
      consensus_score: score,
      provisional_score: null,
      rationale: row.assessment_note,
    };
  });
}

function buildRecruiterCardFromGpt(
  strippedResume: string,
  raw: GptMiniRawResponse,
): RecruiterCard {
  const what_stands_out: StandoutBullet[] = [];
  for (const s of raw.why_this_candidate?.strengths ?? []) {
    if (what_stands_out.length >= 3) break;
    const evidence = s.supporting_quote?.trim() ?? "";
    if (!evidence || !quoteExistsInResume(evidence, strippedResume)) continue;
    what_stands_out.push({ signal: s.signal.trim(), evidence });
  }

  const worth_exploring = (
    raw.why_this_candidate?.watch_points ?? []
  )
    .map((w) => `${w.concern.trim()} — ${w.evidence_basis.trim()}`)
    .filter(Boolean)
    .slice(0, 2);

  const interview_questions = normalizeInterviewQuestions(
    raw.interview_questions ?? [],
  ).slice(0, 2);
  while (interview_questions.length < 2) {
    interview_questions.push(
      "Walk me through a project from your resume where your contribution was hardest to infer from the written profile alone.",
    );
  }

  return {
    candidate_header: {
      display_name: filenameToDisplayName("candidate-resume.pdf"),
      most_recent_title: "See resume",
      total_years_experience: "See resume",
      career_pattern: "See resume",
    },
    what_stands_out,
    worth_exploring,
    interview_questions,
  };
}

function mapToCandidateScoreResult(
  strippedResume: string,
  roleBrief: RoleBrief,
  signals: BeyondKeywordSignals,
  raw: GptMiniRawResponse,
  validatedDimensions: Record<DimensionKey, GptDimensionRow>,
  overallScore: number,
): CandidateScoreResult {
  const skillsIntelligence = matchRequiredSkills(roleBrief, strippedResume);
  const contradictions = parseContradictions(raw);
  const { level: confidenceLevel, reason: confidenceReason } = resolveConfidence(
    raw,
    validatedDimensions,
    strippedResume,
  );
  const confidence = mapConfidence(confidenceLevel, confidenceReason);

  const dimension_scores = {} as Record<DimensionKey, DimensionScore>;
  for (const key of DIMENSION_KEYS) {
    const row = validatedDimensions[key];
    dimension_scores[key] = {
      score: row.score,
      rationale: row.assessment_note,
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

  const watch_signals: AttributedFlag[] = [
    ...(raw.why_this_candidate?.watch_points ?? [])
      .slice(0, 4)
      .map((w) => attributed(w.concern)),
    ...contradictions.slice(0, 3).map((c) => attributed(`Contradiction: ${c}`)),
  ].slice(0, 5);

  const review_flags: AttributedFlag[] = (raw.must_haves_check ?? [])
    .filter((m) => m.status === "absent")
    .slice(0, 4)
    .map((m) => attributed(`Must-have gap: ${m.requirement}`));

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
    recruiter_card: buildRecruiterCardFromGpt(strippedResume, raw),
    resume_quality_signals: signals,
    skills_intelligence: skillsIntelligence,
  };
}

/**
 * Score a candidate with a single GPT-4o mini call (temperature 0, JSON mode).
 * Resume text must already be PII-stripped.
 */
export async function scoreCandidate(
  strippedResumeText: string,
  roleBrief: RoleBrief,
  beyondKeywordSignals: BeyondKeywordSignals,
  github?: CandidateSignalProfile["github"] | null,
): Promise<CandidateScoreResult> {
  const stripped = strippedResumeText.trim();
  if (!stripped) {
    throw new Error("Stripped resume text is required for scoring.");
  }

  const client = new OpenAI({ apiKey: getApiKey("openai") });
  const userMessage = buildUserMessage(
    roleBrief,
    stripped,
    beyondKeywordSignals,
    github,
  );

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    max_tokens: 2000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? "";
  const parsed = parseGptResponse(parseJsonFromModel(text));
  let dimensions = parseDimensionScores(parsed);
  dimensions = validateDimensionQuotes(dimensions, stripped);

  const scoreByDim = Object.fromEntries(
    DIMENSION_KEYS.map((k) => [k, dimensions[k].score]),
  ) as Record<DimensionKey, number>;

  const overallScore = computeWeightedOverall(scoreByDim, roleBrief);

  return mapToCandidateScoreResult(
    stripped,
    roleBrief,
    beyondKeywordSignals,
    parsed,
    dimensions,
    overallScore,
  );
}
