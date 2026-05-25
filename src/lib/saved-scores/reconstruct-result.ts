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
import { AGREEMENT_THRESHOLD } from "@/lib/saved-scores/legacy-types";
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
  if (spread <= AGREEMENT_THRESHOLD) return "unanimous";
  return "divergent";
}

function buildConsensusFallback(
  dimensionScores: NonNullable<SavedScoreRow["dimension_scores"]>,
): DimensionConsensusDetail[] {
  return DIMENSION_KEYS.map((key) => {
    const dim = dimensionScores[key];
    const modelScores = {
      gpt4o: dim.model_scores?.gpt4o ?? dim.score,
      ...(dim.model_scores?.claude != null
        ? { claude: dim.model_scores.claude }
        : {}),
      ...(dim.model_scores?.gemini != null
        ? { gemini: dim.model_scores.gemini }
        : {}),
    };
    const scoreValues = [
      modelScores.gpt4o,
      modelScores.claude,
      modelScores.gemini,
    ].filter((s): s is number => s != null);
    const spread =
      scoreValues.length > 1
        ? Math.max(...scoreValues) - Math.min(...scoreValues)
        : 0;
    const agreement = dim.agreement ?? agreementFromSpread(spread);
    const cell = {
      score: modelScores.gpt4o,
      reason: dim.rationale,
      dimension_flag: dim.rationale,
    };

    return {
      key,
      label: DIMENSION_LABELS[key],
      model_scores: modelScores,
      model_details: {
        gpt4o: cell,
        ...(modelScores.claude != null
          ? { claude: { ...cell, score: modelScores.claude } }
          : {}),
        ...(modelScores.gemini != null
          ? { gemini: { ...cell, score: modelScores.gemini } }
          : {}),
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
      resume_quality_signals: snapshot.resume_quality_signals ?? null,
      skills_intelligence: snapshot.skills_intelligence ?? null,
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
    model_raw_responses: { gpt4o: null },
    model_flags: {
      gpt4o: { insufficient: [] },
    },
    recruiter_card: buildFallbackRecruiterCard(
      row.candidate_filename ?? "candidate.pdf",
      [
        ...normalizeFlags(row.review_flags).map((f) => f.text),
        ...normalizeFlags(row.watch_signals).map((f) => f.text),
      ],
      [],
    ),
    resume_quality_signals: null,
    skills_intelligence: null,
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
