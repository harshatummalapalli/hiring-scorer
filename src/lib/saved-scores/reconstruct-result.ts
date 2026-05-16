import type {
  CandidateScoreResult,
  DimensionConsensusDetail,
  DimensionKey,
} from "@/types/score";
import { DIMENSION_LABELS } from "@/types/score";
import {
  CONFIDENCE_LABEL_HIGH,
  CONFIDENCE_LABEL_MEDIUM,
  CONFIDENCE_LABEL_REVIEW,
  toRecruiterConfidenceLabel,
} from "@/lib/scoring/recruiter-labels";
import { buildFallbackRecruiterCard } from "@/lib/scoring/recruiter-card";
import type { SavedScoreRow } from "@/types/saved-score";

const DIMENSION_KEYS: DimensionKey[] = [
  "skills",
  "trajectory",
  "domain",
  "seniority",
  "tenure",
];

function agreementFromSpread(spread: number): DimensionConsensusDetail["agreement"] {
  if (spread <= 10) return "unanimous";
  return "divergent";
}

function buildConsensusFallback(
  dimensionScores: NonNullable<SavedScoreRow["dimension_scores"]>,
): DimensionConsensusDetail[] {
  return DIMENSION_KEYS.map((key) => {
    const dim = dimensionScores[key];
    const modelScores = dim.model_scores ?? {
      claude: dim.score,
      gpt4o: dim.score,
      gemini: dim.score,
    };
    const spread =
      Math.max(modelScores.claude, modelScores.gpt4o, modelScores.gemini) -
      Math.min(modelScores.claude, modelScores.gpt4o, modelScores.gemini);
    const agreement = dim.agreement ?? agreementFromSpread(spread);

    return {
      key,
      label: DIMENSION_LABELS[key],
      model_scores: modelScores,
      model_details: {
        gpt4o: {
          score: modelScores.gpt4o,
          reason: dim.rationale,
          dimension_flag: dim.rationale,
        },
        claude: {
          score: modelScores.claude,
          reason: dim.rationale,
          dimension_flag: dim.rationale,
        },
        gemini: {
          score: modelScores.gemini,
          reason: dim.rationale,
          dimension_flag: dim.rationale,
        },
      },
      spread,
      agreement,
      dimension_confidence_label:
        agreement === "unanimous"
          ? CONFIDENCE_LABEL_HIGH
          : agreement === "majority"
            ? CONFIDENCE_LABEL_MEDIUM
            : CONFIDENCE_LABEL_REVIEW,
      consensus_score: agreement === "divergent" ? null : dim.score,
      provisional_score: agreement === "divergent" ? dim.score : null,
      dissent: dim.dissent,
      rationale: dim.rationale,
    };
  });
}

export function reconstructCandidateResult(
  row: SavedScoreRow,
): CandidateScoreResult | null {
  if (row.score_snapshot && typeof row.score_snapshot === "object") {
    const snapshot = row.score_snapshot as CandidateScoreResult;
    if (snapshot.recruiter_card) return snapshot;
    return {
      ...snapshot,
      recruiter_card: buildFallbackRecruiterCard(
        row.candidate_filename ?? "candidate.pdf",
        [
          ...snapshot.review_flags.map((f) => f.text),
          ...snapshot.watch_signals.map((f) => f.text),
          ...snapshot.gaps.map((f) => f.text),
        ],
        [],
      ),
    };
  }

  if (!row.dimension_scores) return null;

  const dimension_consensus = buildConsensusFallback(row.dimension_scores);
  const confidence_label = toRecruiterConfidenceLabel(row.confidence_level);

  return {
    overall_score: row.overall_score ?? 0,
    overall_provisional: dimension_consensus.some(
      (d) => d.agreement === "divergent",
    ),
    confidence_level:
      confidence_label === CONFIDENCE_LABEL_HIGH
        ? "high"
        : confidence_label === CONFIDENCE_LABEL_REVIEW
          ? "review"
          : "medium",
    confidence_label,
    review_recommended: confidence_label === CONFIDENCE_LABEL_REVIEW,
    dimension_scores: row.dimension_scores,
    dimension_consensus,
    green_flags: normalizeFlags(row.green_flags),
    watch_signals: normalizeFlags(row.watch_signals),
    review_flags: normalizeFlags(row.review_flags),
    risks: [],
    gaps: [],
    dissent_signals: [],
    model_raw_responses: { gpt4o: null, claude: null, gemini: null },
    model_flags: {
      claude: { risks: [], gaps: [] },
      gpt4o: { insufficient: [] },
      gemini: { green_flags: [], watch_signals: [] },
    },
    recruiter_card: buildFallbackRecruiterCard(
      row.candidate_filename ?? "candidate.pdf",
      [
        ...normalizeFlags(row.review_flags).map((f) => f.text),
        ...normalizeFlags(row.watch_signals).map((f) => f.text),
      ],
      [],
    ),
  };
}

function normalizeFlags(
  flags: SavedScoreRow["green_flags"],
): CandidateScoreResult["green_flags"] {
  if (!flags) return [];
  return flags.map((f) =>
    typeof f === "string"
      ? { text: f, sources: [], sourceLabel: "" }
      : f,
  );
}
