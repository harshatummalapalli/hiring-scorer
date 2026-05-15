import {
  configurationIdFromRoles,
  configurationLabelFromRoles,
  roleAssignmentFromScenarioRoles,
} from "@/lib/scoring/provider-labels";
import type { AnalysisDimensionRecord, AnalysisRunEntry } from "@/lib/analysis/analysis-entry";
import type { ScoringRun } from "@/types/scoring-run";
import type { DimensionKey, ModelRole } from "@/types/score";

const DIMENSION_KEYS: DimensionKey[] = [
  "skills",
  "trajectory",
  "domain",
  "seniority",
  "tenure",
];

function buildDimensionsFromRun(run: ScoringRun): {
  dimensions: Record<DimensionKey, AnalysisDimensionRecord>;
  overallOnly: boolean;
} {
  const hasPerModel =
    run.per_model_scores &&
    DIMENSION_KEYS.every((k) => run.per_model_scores?.[k] != null);

  if (hasPerModel && run.per_model_scores) {
    const dimensions = {} as Record<DimensionKey, AnalysisDimensionRecord>;
    for (const key of DIMENSION_KEYS) {
      const modelScores = run.per_model_scores[key];
      const spread = run.spreads?.[key] ?? 0;
      const agreement =
        (run.confidence_levels?.[key]?.agreement as AnalysisDimensionRecord["agreement"]) ??
        (spread <= 10 ? "unanimous" : "divergent");
      const consensusScore =
        run.dimension_scores?.[key]?.score ??
        Math.round(
          (modelScores.claude + modelScores.gpt4o + modelScores.gemini) / 3,
        );
      dimensions[key] = {
        modelScores,
        spread,
        agreement,
        consensusScore,
      };
    }
    return { dimensions, overallOnly: false };
  }

  const dimensions = {} as Record<DimensionKey, AnalysisDimensionRecord>;
  const overall = run.overall_score;
  for (const key of DIMENSION_KEYS) {
    dimensions[key] = {
      modelScores: { claude: overall, gpt4o: overall, gemini: overall },
      spread: 0,
      agreement: "unanimous",
      consensusScore: overall,
    };
  }
  return { dimensions, overallOnly: true };
}

export function scoringRunToAnalysisEntry(
  run: ScoringRun,
  scenarioNumber: number,
): AnalysisRunEntry | null {
  const roleAssignment = roleAssignmentFromScenarioRoles(
    run.model_extractor,
    run.model_advocate,
    run.model_scorer,
  );
  if (!roleAssignment) return null;

  const { dimensions, overallOnly } = buildDimensionsFromRun(run);

  return {
    id: run.id,
    candidateFilename: run.candidate_filename,
    scenarioLabel: run.scenario_label,
    scenarioNumber,
    configurationId: configurationIdFromRoles(
      run.model_extractor,
      run.model_advocate,
      run.model_scorer,
    ),
    configurationLabel: configurationLabelFromRoles(
      run.model_extractor,
      run.model_advocate,
      run.model_scorer,
    ),
    roleAssignment,
    overallConsensusScore: run.overall_score,
    dimensions,
    overallOnly,
    source: run.scenario_label.startsWith("Scenario ")
      ? "seed"
      : "live",
  };
}

export function assignScenarioNumbers(
  entries: AnalysisRunEntry[],
): AnalysisRunEntry[] {
  const scenarioOrder: string[] = [];
  for (const e of entries) {
    const key = e.scenarioLabel;
    if (!scenarioOrder.includes(key)) scenarioOrder.push(key);
  }
  return entries.map((e) => ({
    ...e,
    scenarioNumber: scenarioOrder.indexOf(e.scenarioLabel) + 1,
  }));
}

export function mergeAnalysisEntries(
  primary: AnalysisRunEntry[],
  secondary: AnalysisRunEntry[],
): AnalysisRunEntry[] {
  const byKey = new Map<string, AnalysisRunEntry>();
  for (const e of [...primary, ...secondary]) {
    const key = `${e.candidateFilename.toLowerCase()}::${e.scenarioLabel.toLowerCase()}`;
    byKey.set(key, e);
  }
  return assignScenarioNumbers([...byKey.values()]);
}
