import type { FunctionalRole, RoleAssignment } from "@/lib/config/model-configuration";
import { modelForFunctionalRole } from "@/lib/config/model-configuration";
import { configurationIdFromRoles } from "@/lib/scoring/provider-labels";
import type { AnalysisRunEntry } from "@/lib/analysis/analysis-entry";
import type { DimensionKey, ModelRole } from "@/types/score";
import { DIMENSION_LABELS } from "@/types/score";

const DIMENSION_KEYS: DimensionKey[] = [
  "skills",
  "trajectory",
  "domain",
  "seniority",
  "tenure",
];

const MODELS: ModelRole[] = ["gpt4o", "claude", "gemini"];
const FUNCTIONAL_ROLES: FunctionalRole[] = [
  "signal_extractor",
  "devils_advocate",
  "structured_scorer",
];

export const FUNCTIONAL_ROLE_LABELS: Record<FunctionalRole, string> = {
  signal_extractor: "Signal Extractor",
  devils_advocate: "Devil's Advocate",
  structured_scorer: "Structured Scorer",
};

export const MODEL_PROVIDER_LABELS: Record<ModelRole, string> = {
  gpt4o: "GPT-4o",
  claude: "Claude",
  gemini: "Gemini Flash",
};

export const MIN_RUNS_FOR_RELIABLE = 6;
export const MIN_CONFIGURATIONS = 2;
export const MIN_CANDIDATES = 2;

export type DataSufficiency = {
  sufficient: boolean;
  runCount: number;
  configurationCount: number;
  candidateCount: number;
  message: string;
};

export type ModelRoleStabilityRow = {
  model: ModelRole;
  functionalRole: FunctionalRole;
  runCount: number;
  averageScore: number;
  variance: number;
  differentiationGap: number;
  scores: number[];
  interpretation: string;
};

export type ConfigurationDifferentiationRow = {
  configurationId: string;
  configurationLabel: string;
  scenarioNumber: number;
  scenarioLabel: string;
  runCount: number;
  candidateCount: number;
  highestOverall: number;
  lowestOverall: number;
  differentiationGap: number;
  rank: number;
};

export type ModelBehaviourRow = {
  model: ModelRole;
  overallAverageScore: number;
  generosity: "generous" | "neutral" | "conservative";
  roleStability: "stable" | "moderate" | "role-sensitive";
  roleVariance: number;
  bestRoleForDifferentiation: FunctionalRole;
  bestRoleGap: number;
  roleAverages: { role: FunctionalRole; average: number; gap: number }[];
  notes: string;
};

export type OptimalConfigurationRecommendation = {
  assignment: RoleAssignment;
  configurationId: string;
  label: string;
  reasoning: string;
  expectedDifferentiationGap: number;
};

export type DimensionReliabilityRow = {
  dimension: DimensionKey;
  label: string;
  totalRuns: number;
  agreedWithin10: number;
  diverged: number;
  agreementRate: number;
  reliability: "high" | "medium" | "low";
  note?: string;
};

export type AnalysisFindings = {
  generatedAt: string;
  sufficiency: DataSufficiency;
  recommendation: OptimalConfigurationRecommendation | null;
  scoreStability: ModelRoleStabilityRow[];
  configurationRanking: ConfigurationDifferentiationRow[];
  modelBehaviour: ModelBehaviourRow[];
  dimensionReliability: DimensionReliabilityRow[];
  chartData: {
    modelRoleScores: {
      key: string;
      model: ModelRole;
      functionalRole: FunctionalRole;
      scores: { candidate: string; score: number }[];
    }[];
    configurationGaps: { label: string; gap: number }[];
  };
  entries: AnalysisRunEntry[];
  hasOverallOnlyRuns: boolean;
};

function mean(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function variance(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = mean(nums);
  return nums.reduce((s, n) => s + (n - m) ** 2, 0) / nums.length;
}

function assessSufficiency(entries: AnalysisRunEntry[]): DataSufficiency {
  const configurationCount = new Set(entries.map((e) => e.configurationId)).size;
  const candidateCount = new Set(
    entries.map((e) => e.candidateFilename.toLowerCase()),
  ).size;
  const runCount = entries.length;

  const sufficient =
    runCount >= MIN_RUNS_FOR_RELIABLE &&
    configurationCount >= MIN_CONFIGURATIONS &&
    candidateCount >= MIN_CANDIDATES;

  let message: string;
  if (sufficient) {
    message = `Based on ${runCount} runs across ${configurationCount} configurations and ${candidateCount} candidates.`;
  } else {
    const needs: string[] = [];
    if (runCount < MIN_RUNS_FOR_RELIABLE) {
      needs.push(`${MIN_RUNS_FOR_RELIABLE - runCount} more scoring run(s)`);
    }
    if (configurationCount < MIN_CONFIGURATIONS) {
      needs.push(
        `${MIN_CONFIGURATIONS - configurationCount} more distinct configuration(s)`,
      );
    }
    if (candidateCount < MIN_CANDIDATES) {
      needs.push(`${MIN_CANDIDATES - candidateCount} more distinct candidate(s)`);
    }
    message = `Need ${needs.join("; ")} for reliable findings. Current: ${runCount} runs, ${configurationCount} configs, ${candidateCount} candidates.`;
  }

  return {
    sufficient,
    runCount,
    configurationCount,
    candidateCount,
    message,
  };
}

function entryModelAverage(entry: AnalysisRunEntry, model: ModelRole): number {
  if (entry.overallOnly) {
    return entry.overallConsensusScore;
  }
  const scores = DIMENSION_KEYS.map((k) => entry.dimensions[k].modelScores[model]);
  return mean(scores);
}

function allModelScoresInRole(
  entries: AnalysisRunEntry[],
  model: ModelRole,
  functionalRole: FunctionalRole,
): number[] {
  return entries
    .filter((e) => e.roleAssignment[model] === functionalRole)
    .map((e) => entryModelAverage(e, model));
}

function computeScoreStability(
  entries: AnalysisRunEntry[],
): ModelRoleStabilityRow[] {
  const rows: ModelRoleStabilityRow[] = [];

  for (const model of MODELS) {
    for (const functionalRole of FUNCTIONAL_ROLES) {
      const scores = allModelScoresInRole(entries, model, functionalRole);
      if (scores.length === 0) continue;

      const avg = mean(scores);
      const var_ = variance(scores);
      const gap = scores.length >= 2 ? Math.max(...scores) - Math.min(...scores) : 0;

      let interpretation = "";
      if (functionalRole === "signal_extractor") {
        interpretation =
          gap >= 15
            ? "Strong differentiation — good extractor behaviour."
            : gap < 8
              ? "Low spread — extractor may not separate candidates well."
              : "Moderate differentiation.";
      } else if (functionalRole === "structured_scorer") {
        interpretation =
          var_ < 80
            ? "Relatively consistent scoring — literal scorer pattern."
            : "Higher variance — scorer may be influenced by non-explicit signals.";
      } else {
        interpretation =
          "Advocate should flag weak profiles; check gap vs strong candidates.";
      }

      rows.push({
        model,
        functionalRole,
        runCount: scores.length,
        averageScore: Math.round(avg * 10) / 10,
        variance: Math.round(var_ * 10) / 10,
        differentiationGap: gap,
        scores,
        interpretation,
      });
    }
  }

  return rows.sort((a, b) => b.differentiationGap - a.differentiationGap);
}

function computeConfigurationRanking(
  entries: AnalysisRunEntry[],
): ConfigurationDifferentiationRow[] {
  const byConfig = new Map<string, AnalysisRunEntry[]>();
  for (const e of entries) {
    const list = byConfig.get(e.configurationId) ?? [];
    list.push(e);
    byConfig.set(e.configurationId, list);
  }

  const rows: ConfigurationDifferentiationRow[] = [];

  for (const [configurationId, group] of byConfig) {
    const overalls = group.map((e) => e.overallConsensusScore);
    const highest = Math.max(...overalls);
    const lowest = Math.min(...overalls);
    rows.push({
      configurationId,
      configurationLabel: group[0].configurationLabel,
      scenarioNumber: group[0].scenarioNumber,
      scenarioLabel: group[0].scenarioLabel,
      runCount: group.length,
      candidateCount: new Set(group.map((g) => g.candidateFilename)).size,
      highestOverall: highest,
      lowestOverall: lowest,
      differentiationGap: highest - lowest,
      rank: 0,
    });
  }

  rows.sort((a, b) => b.differentiationGap - a.differentiationGap);
  rows.forEach((r, i) => {
    r.rank = i + 1;
  });

  return rows;
}

function computeModelBehaviour(entries: AnalysisRunEntry[]): ModelBehaviourRow[] {
  return MODELS.map((model) => {
    const allScores: number[] = [];
    const roleAverages: ModelBehaviourRow["roleAverages"] = [];

    for (const functionalRole of FUNCTIONAL_ROLES) {
      const scores = allModelScoresInRole(entries, model, functionalRole);
      if (scores.length === 0) continue;
      const avg = mean(scores);
      const gap =
        scores.length >= 2 ? Math.max(...scores) - Math.min(...scores) : 0;
      allScores.push(...scores);
      roleAverages.push({ role: functionalRole, average: avg, gap });
    }

    const overallAverage = mean(allScores);
    const roleVariance = variance(roleAverages.map((r) => r.average));

    const generosity: ModelBehaviourRow["generosity"] =
      overallAverage >= 72
        ? "generous"
        : overallAverage <= 55
          ? "conservative"
          : "neutral";

    const roleStability: ModelBehaviourRow["roleStability"] =
      roleVariance < 25 ? "stable" : roleVariance < 60 ? "moderate" : "role-sensitive";

    const bestRole = [...roleAverages].sort((a, b) => b.gap - a.gap)[0];

    return {
      model,
      overallAverageScore: Math.round(overallAverage * 10) / 10,
      generosity,
      roleStability,
      roleVariance: Math.round(roleVariance * 10) / 10,
      bestRoleForDifferentiation: bestRole?.role ?? "signal_extractor",
      bestRoleGap: bestRole?.gap ?? 0,
      roleAverages,
      notes: `${MODEL_PROVIDER_LABELS[model]} averages ${overallAverage.toFixed(0)} across roles; most differentiation as ${FUNCTIONAL_ROLE_LABELS[bestRole?.role ?? "signal_extractor"]} (gap ${bestRole?.gap ?? 0}).`,
    };
  });
}

function recommendConfiguration(
  entries: AnalysisRunEntry[],
  stability: ModelRoleStabilityRow[],
  configRanking: ConfigurationDifferentiationRow[],
  behaviour: ModelBehaviourRow[],
): OptimalConfigurationRecommendation | null {
  if (entries.length === 0) return null;

  const assignment: RoleAssignment = {
    gpt4o: "signal_extractor",
    claude: "devils_advocate",
    gemini: "structured_scorer",
  };

  const extractorCandidates = stability
    .filter((s) => s.functionalRole === "signal_extractor")
    .sort((a, b) => b.differentiationGap - a.differentiationGap);

  const scorerCandidates = stability
    .filter((s) => s.functionalRole === "structured_scorer")
    .sort((a, b) => a.variance - b.variance);

  const advocateCandidates = stability
    .filter((s) => s.functionalRole === "devils_advocate")
    .sort((a, b) => b.differentiationGap - a.differentiationGap);

  const used = new Set<ModelRole>();

  function pick(
    list: ModelRoleStabilityRow[],
    role: FunctionalRole,
  ): ModelRole | null {
    for (const row of list) {
      if (!used.has(row.model)) {
        assignment[row.model] = role;
        used.add(row.model);
        return row.model;
      }
    }
    return null;
  }

  pick(extractorCandidates, "signal_extractor");
  pick(advocateCandidates, "devils_advocate");
  pick(scorerCandidates, "structured_scorer");

  for (const m of MODELS) {
    if (!used.has(m)) {
      const taken = new Set(Object.values(assignment));
      const remaining = FUNCTIONAL_ROLES.find((r) => !taken.has(r));
      if (remaining) assignment[m] = remaining;
    }
  }

  const configId = configurationIdFromRoles(
    MODEL_PROVIDER_LABELS[modelForFunctionalRole(assignment, "signal_extractor")],
    MODEL_PROVIDER_LABELS[modelForFunctionalRole(assignment, "devils_advocate")],
    MODEL_PROVIDER_LABELS[modelForFunctionalRole(assignment, "structured_scorer")],
  );
  const label = MODELS.map(
    (m) => `${MODEL_PROVIDER_LABELS[m]}=${FUNCTIONAL_ROLE_LABELS[assignment[m]]}`,
  ).join(" · ");

  const matchedHistorical = configRanking.find((c) => c.configurationId === configId);
  const topConfig = configRanking[0];
  const expectedGap =
    matchedHistorical?.differentiationGap ?? topConfig?.differentiationGap ?? 0;

  const gptBeh = behaviour.find((b) => b.model === "gpt4o");
  const claudeBeh = behaviour.find((b) => b.model === "claude");
  const gemBeh = behaviour.find((b) => b.model === "gemini");

  const reasoning = [
    `Recommended assignment prioritises differentiation: ${MODEL_PROVIDER_LABELS[modelForFunctionalRole(assignment, "signal_extractor")]} as Signal Extractor, ${MODEL_PROVIDER_LABELS[modelForFunctionalRole(assignment, "devils_advocate")]} as Devil's Advocate, and ${MODEL_PROVIDER_LABELS[modelForFunctionalRole(assignment, "structured_scorer")]} as Structured Scorer.`,
    topConfig
      ? `Historically, "${topConfig.scenarioLabel}" (${topConfig.configurationLabel}) achieved the largest overall consensus spread (${topConfig.differentiationGap} points between strongest and weakest candidate).`
      : "",
    gptBeh && claudeBeh && gemBeh
      ? `Observed generosity: GPT-4o ${gptBeh.generosity}, Claude ${claudeBeh.generosity}, Gemini ${gemBeh.generosity}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    assignment,
    configurationId: configId,
    label,
    reasoning,
    expectedDifferentiationGap: expectedGap,
  };
}

function computeDimensionReliability(
  entries: AnalysisRunEntry[],
): DimensionReliabilityRow[] {
  const detailRuns = entries.filter((e) => !e.overallOnly);

  return DIMENSION_KEYS.map((dimension) => {
    if (detailRuns.length === 0) {
      return {
        dimension,
        label: DIMENSION_LABELS[dimension],
        totalRuns: 0,
        agreedWithin10: 0,
        diverged: 0,
        agreementRate: 0,
        reliability: "low" as const,
        note: "No runs with per-dimension model scores yet.",
      };
    }

    let agreed = 0;
    let diverged = 0;
    for (const e of detailRuns) {
      const d = e.dimensions[dimension];
      if (!d) continue;
      if (d.spread <= 10 && d.agreement !== "divergent") agreed++;
      else diverged++;
    }
    const total = agreed + diverged;
    const rate = total > 0 ? agreed / total : 0;
    return {
      dimension,
      label: DIMENSION_LABELS[dimension],
      totalRuns: total,
      agreedWithin10: agreed,
      diverged,
      agreementRate: Math.round(rate * 100),
      reliability: rate >= 0.7 ? "high" : rate >= 0.45 ? "medium" : "low",
    };
  });
}

function buildChartData(
  entries: AnalysisRunEntry[],
  configRanking: ConfigurationDifferentiationRow[],
): AnalysisFindings["chartData"] {
  const modelRoleScores: AnalysisFindings["chartData"]["modelRoleScores"] = [];

  for (const model of MODELS) {
    for (const functionalRole of FUNCTIONAL_ROLES) {
      const points = entries
        .filter((e) => e.roleAssignment[model] === functionalRole)
        .map((e) => ({
          candidate: e.candidateFilename.replace(/\.[^.]+$/, ""),
          score: Math.round(entryModelAverage(e, model)),
        }));
      if (points.length === 0) continue;
      modelRoleScores.push({
        key: `${model}-${functionalRole}`,
        model,
        functionalRole,
        scores: points,
      });
    }
  }

  return {
    modelRoleScores,
    configurationGaps: configRanking.map((c) => ({
      label: c.scenarioLabel,
      gap: c.differentiationGap,
    })),
  };
}

export function computeAnalysisFindings(
  entries: AnalysisRunEntry[],
): AnalysisFindings {
  const sufficiency = assessSufficiency(entries);
  const scoreStability = computeScoreStability(entries);
  const configurationRanking = computeConfigurationRanking(entries);
  const modelBehaviour = computeModelBehaviour(entries);
  const dimensionReliability = computeDimensionReliability(entries);
  const recommendation = recommendConfiguration(
    entries,
    scoreStability,
    configurationRanking,
    modelBehaviour,
  );
  const chartData = buildChartData(entries, configurationRanking);
  const hasOverallOnlyRuns = entries.some((e) => e.overallOnly);

  return {
    generatedAt: new Date().toISOString(),
    sufficiency,
    recommendation,
    scoreStability,
    configurationRanking,
    modelBehaviour,
    dimensionReliability,
    chartData,
    entries,
    hasOverallOnlyRuns,
  };
}

export function downloadAnalysisJson(findings: AnalysisFindings): void {
  const blob = new Blob([JSON.stringify(findings, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hiring-scorer-analysis-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
