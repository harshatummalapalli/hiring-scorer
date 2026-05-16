import type { RoleBrief } from "@/types/role-brief";
import type { CandidateScoreResult, DimensionKey } from "@/types/score";
import { DIMENSION_LABELS, MODEL_ROLE_LABELS } from "@/types/score";

const DIMENSION_KEYS: DimensionKey[] = [
  "skills",
  "trajectory",
  "domain",
  "seniority",
  "tenure",
];

const AGREEMENT_THRESHOLD = 10;

import type { ScoringArchitecture } from "@/types/scoring-debug";

export const SCORING_ARCHITECTURE: ScoringArchitecture = "3-call";
export const MODEL_CALL_COUNT = 3;

export function buildScoringConfigurationSummary(roleBrief: RoleBrief): string {
  const totalWeight = DIMENSION_KEYS.reduce(
    (s, k) =>
      s +
      {
        skills: roleBrief.weight_skills,
        trajectory: roleBrief.weight_trajectory,
        domain: roleBrief.weight_domain,
        seniority: roleBrief.weight_seniority,
        tenure: roleBrief.weight_tenure,
      }[k],
    0,
  );

  return [
    `Architecture: ${SCORING_ARCHITECTURE} parallel (${MODEL_CALL_COUNT} model API calls)`,
    `• ${MODEL_ROLE_LABELS.gpt4o}`,
    `• ${MODEL_ROLE_LABELS.claude}`,
    `• ${MODEL_ROLE_LABELS.gemini}`,
    `Role brief: ${roleBrief.title}${roleBrief.title_band ? ` · ${roleBrief.title_band}` : ""}`,
    `Brief ID: ${roleBrief.id}`,
    `Dimension weights (total ${totalWeight}): skills=${roleBrief.weight_skills}, trajectory=${roleBrief.weight_trajectory}, domain=${roleBrief.weight_domain}, seniority=${roleBrief.weight_seniority}, tenure=${roleBrief.weight_tenure}`,
    `Consensus rule: spread ≤${AGREEMENT_THRESHOLD} → unanimous; two within ${AGREEMENT_THRESHOLD} → majority; else divergent (provisional avg)`,
    `Overall score: round(Σ dimension_score × weight / Σ weights)`,
  ].join("\n");
}

export function buildConsensusCalculationSteps(
  result: CandidateScoreResult,
  roleBrief: RoleBrief,
): string[] {
  const steps: string[] = [];
  const weights: Record<DimensionKey, number> = {
    skills: roleBrief.weight_skills,
    trajectory: roleBrief.weight_trajectory,
    domain: roleBrief.weight_domain,
    seniority: roleBrief.weight_seniority,
    tenure: roleBrief.weight_tenure,
  };
  const totalWeight = DIMENSION_KEYS.reduce((s, k) => s + weights[k], 0);

  steps.push("=== Per-dimension consensus ===");

  let weightedSum = 0;

  for (const key of DIMENSION_KEYS) {
    const dim = result.dimension_scores[key];
    const detail = result.dimension_consensus.find((d) => d.key === key);
    if (!detail) continue;

    const { claude, gpt4o, gemini } = detail.model_scores;
    const w = weights[key];
    const contribution = dim.score * w;
    weightedSum += contribution;

    steps.push("");
    steps.push(`【${DIMENSION_LABELS[key]}】 weight=${w}`);
    steps.push(
      `  Model scores: Gemini (Signal Extractor)=${gemini}, Claude (Devil's Advocate)=${claude}, GPT-4o (Structured Scorer)=${gpt4o}`,
    );
    steps.push(`  Spread = max − min = ${detail.spread} (threshold ${AGREEMENT_THRESHOLD})`);
    steps.push(`  Agreement: ${detail.agreement} → ${detail.dimension_confidence_label}`);

    if (detail.agreement === "unanimous" && detail.consensus_score != null) {
      steps.push(
        `  Consensus score = round((${claude} + ${gpt4o} + ${gemini}) / 3) = ${detail.consensus_score}`,
      );
    } else if (detail.agreement === "majority" && detail.consensus_score != null) {
      steps.push(`  Consensus score = majority pair average = ${detail.consensus_score}`);
      if (detail.dissent) {
        steps.push(
          `  Dissent: ${detail.dissent.modelLabel}=${detail.dissent.score} — ${detail.dissent.reason ?? "—"}`,
        );
      }
    } else {
      steps.push(`  No pair within ${AGREEMENT_THRESHOLD} → divergent`);
      steps.push(
        `  Provisional score = round((${claude} + ${gpt4o} + ${gemini}) / 3) = ${detail.provisional_score}`,
      );
    }

    const effectiveLabel = dim.provisional ? "provisional" : "consensus";
    steps.push(`  Effective dimension score (${effectiveLabel}) = ${dim.score}`);
    steps.push(`  Weighted contribution = ${dim.score} × ${w} = ${contribution}`);
  }

  steps.push("");
  steps.push("=== Overall score ===");
  steps.push(`  Σ (dimension_score × weight) = ${weightedSum}`);
  steps.push(`  Σ weights = ${totalWeight}`);
  steps.push(`  overall_score = round(${weightedSum} / ${totalWeight}) = ${result.overall_score}`);
  steps.push(`  Overall confidence: ${result.confidence_label}`);
  if (result.overall_provisional) {
    steps.push("  * Overall marked provisional (≥1 dimension divergent)");
  }

  return steps;
}
