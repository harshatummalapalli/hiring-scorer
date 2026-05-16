import type { RoleBrief } from "@/types/role-brief";
import type {
  AttributedFlag,
  CandidateScoreResult,
  DimensionConsensusDetail,
  DimensionKey,
  DimensionScore,
  ModelRole,
} from "@/types/score";
import {
  CONFIDENCE_LABEL_HIGH,
  CONFIDENCE_LABEL_MEDIUM,
  CONFIDENCE_LABEL_REVIEW,
  modelRoleDisplayName,
} from "@/lib/scoring/recruiter-labels";
import { DIMENSION_LABELS } from "@/types/score";
import {
  flagTextsAreDuplicate,
  MAX_GREEN_FLAGS,
  MAX_GPT_GAPS,
  MAX_GPT_RISKS,
  MAX_WATCH_SIGNALS,
  mergeAttributedFlags,
  type FlagEntry,
} from "./merge-flags";
import {
  agreementToConfidenceLabel,
  buildDimensionModelDetails,
} from "./format-dimension-details";
import type {
  DevilsAdvocateResult,
  SignalExtractorResult,
  StructuredScorerResult,
} from "./model-runners";
import type { ModelRawResponses } from "@/types/score";
import type { ResumeQualitySignals } from "@/lib/intelligence/beyond-keywords";
import { buildRecruiterCard } from "@/lib/scoring/recruiter-card";
import { enrichRecruiterCardWithResumeSignals } from "@/lib/scoring/merge-resume-signals";

const DIMENSION_KEYS: DimensionKey[] = [
  "skills",
  "trajectory",
  "domain",
  "seniority",
  "tenure",
];

const MODEL_LABELS: Record<ModelRole, string> = {
  claude: modelRoleDisplayName("claude"),
  gpt4o: modelRoleDisplayName("gpt4o"),
  gemini: modelRoleDisplayName("gemini"),
};

const AGREEMENT_THRESHOLD = 10;

type DimScores = { claude: number; gpt4o: number; gemini: number };

function computeWeightedOverall(
  dimensions: Record<DimensionKey, DimensionScore>,
  brief: RoleBrief,
): number {
  const weights: Record<DimensionKey, number> = {
    skills: brief.weight_skills,
    trajectory: brief.weight_trajectory,
    domain: brief.weight_domain,
    seniority: brief.weight_seniority,
    tenure: brief.weight_tenure,
  };
  const total = DIMENSION_KEYS.reduce((s, k) => s + weights[k], 0);
  const sum = DIMENSION_KEYS.reduce(
    (s, k) => s + (dimensions[k]?.score ?? 0) * weights[k],
    0,
  );
  if (total <= 0 || !Number.isFinite(sum)) return 0;
  const overall = Math.round(sum / total);
  return Number.isFinite(overall) ? Math.max(0, Math.min(100, overall)) : 0;
}

function pairWithin(a: number, b: number): boolean {
  return Math.abs(a - b) <= AGREEMENT_THRESHOLD;
}

function provisionalModelAverage(scores: DimScores): number {
  return Math.round((scores.claude + scores.gpt4o + scores.gemini) / 3);
}

function analyzeDimension(
  key: DimensionKey,
  scores: DimScores,
  structuredScorer: StructuredScorerResult,
  signalExtractor: SignalExtractorResult,
  devilsAdvocate: DevilsAdvocateResult,
): DimensionConsensusDetail {
  const values = [
    { model: "claude" as const, score: scores.claude },
    { model: "gpt4o" as const, score: scores.gpt4o },
    { model: "gemini" as const, score: scores.gemini },
  ];

  const spread = Math.max(...values.map((v) => v.score)) - Math.min(...values.map((v) => v.score));

  let agreement: DimensionConsensusDetail["agreement"] = "divergent";
  let consensusScore: number | null = null;
  let provisionalScore: number | null = null;
  let dissent: DimensionConsensusDetail["dissent"];

  const allAgree = spread <= AGREEMENT_THRESHOLD;
  if (allAgree) {
    agreement = "unanimous";
    consensusScore = Math.round(
      (scores.claude + scores.gpt4o + scores.gemini) / 3,
    );
  } else {
    const pairs: [ModelRole, ModelRole, number][] = [];
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        if (pairWithin(values[i].score, values[j].score)) {
          pairs.push([values[i].model, values[j].model, (values[i].score + values[j].score) / 2]);
        }
      }
    }

    if (pairs.length >= 1) {
      agreement = "majority";
      const bestPair = pairs[0];
      consensusScore = Math.round(bestPair[2]);
      const majorityModels = new Set([bestPair[0], bestPair[1]]);
      const outlier = values.find((v) => !majorityModels.has(v.model));
      if (outlier) {
        const reason =
          outlier.model === "claude"
            ? devilsAdvocate.dimension_scores[key].reason
            : outlier.model === "gpt4o"
              ? structuredScorer.dimensions[key].reason
              : signalExtractor.dimensions[key].inference_notes ??
                signalExtractor.dimensions[key].concerning_signals[0];
        dissent = {
          model: outlier.model,
          modelLabel: MODEL_LABELS[outlier.model],
          score: outlier.score,
          reason,
        };
      }
    } else {
      agreement = "divergent";
      consensusScore = null;
      provisionalScore = provisionalModelAverage(scores);
    }
  }

  const rationale = [
    `${modelRoleDisplayName("claude")} ${scores.claude}`,
    `${modelRoleDisplayName("gpt4o")} ${scores.gpt4o}`,
    `${modelRoleDisplayName("gemini")} ${scores.gemini}`,
    structuredScorer.dimensions[key].insufficient_data
      ? "(insufficient data flagged)"
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const model_details = buildDimensionModelDetails(
    key,
    signalExtractor,
    devilsAdvocate,
    structuredScorer,
  );

  return {
    key,
    label: DIMENSION_LABELS[key],
    model_scores: scores,
    model_details,
    spread,
    agreement,
    dimension_confidence_label: agreementToConfidenceLabel(agreement),
    consensus_score: consensusScore,
    provisional_score: provisionalScore,
    dissent,
    rationale,
  };
}

function buildGreenFlags(signalExtractor: SignalExtractorResult): AttributedFlag[] {
  const entries: FlagEntry[] = signalExtractor.green_flags.map((f) => ({
    text: f.text,
    source: "gemini" as const,
  }));
  return mergeAttributedFlags(entries, MAX_GREEN_FLAGS);
}

function buildWatchSignals(
  signalExtractor: SignalExtractorResult,
  devilsAdvocate: DevilsAdvocateResult,
  structuredScorer: StructuredScorerResult,
): AttributedFlag[] {
  const entries: FlagEntry[] = [];

  for (const f of signalExtractor.watch_signals) {
    entries.push({ text: f.text, source: "gemini" });
  }
  for (const r of devilsAdvocate.risks) {
    entries.push({ text: r, source: "claude" });
  }
  for (const key of DIMENSION_KEYS) {
    if (structuredScorer.dimensions[key].insufficient_data) {
      entries.push({
        text: `${DIMENSION_LABELS[key]}: insufficient data in profile (${modelRoleDisplayName("gpt4o")} scored 0)`,
        source: "gpt4o",
      });
    }
  }

  return mergeAttributedFlags(entries, MAX_WATCH_SIGNALS);
}

function buildReviewFlags(
  devilsAdvocate: DevilsAdvocateResult,
  watch: AttributedFlag[],
): AttributedFlag[] {
  const entries: FlagEntry[] = devilsAdvocate.gaps.map((g) => ({
    text: g,
    source: "claude" as const,
  }));
  const merged = mergeAttributedFlags(entries, MAX_GPT_GAPS);
  return merged.filter(
    (gap) => !watch.some((w) => flagTextsAreDuplicate(w.text, gap.text)),
  );
}

export function buildConsensusResult(
  roleBrief: RoleBrief,
  structuredScorer: StructuredScorerResult,
  signalExtractor: SignalExtractorResult,
  devilsAdvocate: DevilsAdvocateResult,
  model_raw_responses: ModelRawResponses,
  resumeText: string,
  candidateFilename = "candidate.pdf",
  resumeQualitySignals?: ResumeQualitySignals,
): CandidateScoreResult {
  const dimensionDetails: DimensionConsensusDetail[] = [];
  const dimension_scores = {} as Record<DimensionKey, DimensionScore>;

  for (const key of DIMENSION_KEYS) {
    const scores: DimScores = {
      claude: devilsAdvocate.dimension_scores[key].score,
      gpt4o: structuredScorer.dimensions[key].score,
      gemini: signalExtractor.dimensions[key].score,
    };

    const detail = analyzeDimension(
      key,
      scores,
      structuredScorer,
      signalExtractor,
      devilsAdvocate,
    );
    dimensionDetails.push(detail);

    const isProvisional = detail.agreement === "divergent";
    const effectiveScore =
      detail.consensus_score ??
      detail.provisional_score ??
      provisionalModelAverage(scores);

    dimension_scores[key] = {
      score: effectiveScore,
      provisional: isProvisional,
      rationale: detail.rationale,
      model_scores: scores,
      agreement: detail.agreement,
      dissent: detail.dissent,
    };
  }

  const anyDivergent = dimensionDetails.some((d) => d.agreement === "divergent");
  const allUnanimous = dimensionDetails.every((d) => d.agreement === "unanimous");

  let confidence_label: CandidateScoreResult["confidence_label"];
  let confidence_level: CandidateScoreResult["confidence_level"];
  let review_recommended = false;

  if (anyDivergent) {
    review_recommended = true;
    confidence_label = CONFIDENCE_LABEL_REVIEW;
    confidence_level = "review";
  } else if (allUnanimous) {
    confidence_label = CONFIDENCE_LABEL_HIGH;
    confidence_level = "high";
  } else {
    confidence_label = CONFIDENCE_LABEL_MEDIUM;
    confidence_level = "medium";
  }

  const green_flags = buildGreenFlags(signalExtractor);
  const watch_signals = buildWatchSignals(
    signalExtractor,
    devilsAdvocate,
    structuredScorer,
  );
  const review_flags = buildReviewFlags(devilsAdvocate, watch_signals);

  const dissent_signals = dimensionDetails
    .filter((d) => d.dissent)
    .map(
      (d) =>
        `${d.label}: ${d.dissent!.modelLabel} scored ${d.dissent!.score} (majority ${d.consensus_score}) — ${d.dissent!.reason || "no reason given"}`,
    );

  const model_flags = {
    claude: { risks: devilsAdvocate.risks, gaps: devilsAdvocate.gaps },
    gpt4o: {
      insufficient: DIMENSION_KEYS.filter(
        (k) => structuredScorer.dimensions[k].insufficient_data,
      ).map((k) => DIMENSION_LABELS[k]),
    },
    gemini: {
      green_flags: signalExtractor.green_flags.map((f) => f.text),
      watch_signals: signalExtractor.watch_signals.map((f) => f.text),
    },
  };

  const overall_score = computeWeightedOverall(dimension_scores, roleBrief);

  const worthExploringCandidates = [
    ...devilsAdvocate.gaps,
    ...devilsAdvocate.risks,
    ...watch_signals.map((w) => w.text),
    ...review_flags.map((r) => r.text),
  ];

  let recruiter_card = buildRecruiterCard(
    candidateFilename,
    resumeText,
    signalExtractor,
    devilsAdvocate,
    worthExploringCandidates,
  );

  if (resumeQualitySignals) {
    recruiter_card = enrichRecruiterCardWithResumeSignals(
      recruiter_card,
      resumeText,
      resumeQualitySignals,
    );
  }

  return {
    overall_score,
    overall_provisional: review_recommended,
    confidence_level,
    confidence_label,
    review_recommended,
    dimension_scores,
    dimension_consensus: dimensionDetails,
    green_flags,
    watch_signals,
    review_flags,
    risks: mergeAttributedFlags(
      devilsAdvocate.risks.map((r) => ({ text: r, source: "claude" as const })),
      MAX_GPT_RISKS,
    ),
    gaps: mergeAttributedFlags(
      devilsAdvocate.gaps.map((g) => ({ text: g, source: "claude" as const })),
      MAX_GPT_GAPS,
    ),
    dissent_signals,
    model_raw_responses,
    model_flags,
    recruiter_card,
    resume_quality_signals: resumeQualitySignals ?? null,
  };
}
