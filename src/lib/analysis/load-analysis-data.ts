import {
  assignScenarioNumbers,
  mergeAnalysisEntries,
  scoringRunToAnalysisEntry,
} from "@/lib/analysis/scoring-run-adapter";
import type { AnalysisRunEntry } from "@/lib/analysis/analysis-entry";
import { getHistoricalSeedRuns } from "@/lib/analysis/seed-historical";
import {
  configurationIdFromRoles,
  configurationLabelFromRoles,
  roleAssignmentFromScenarioRoles,
} from "@/lib/scoring/provider-labels";
import type { ScoringRun, ScoringRunInsert } from "@/types/scoring-run";

function seedInsertToAnalysisEntry(
  seed: ScoringRunInsert,
  index: number,
): AnalysisRunEntry | null {
  const roleAssignment = roleAssignmentFromScenarioRoles(
    seed.model_extractor,
    seed.model_advocate,
    seed.model_scorer,
  );
  if (!roleAssignment) return null;

  const overall = seed.overall_score;
  const dimensions = {
    skills: {
      modelScores: { claude: overall, gpt4o: overall, gemini: overall },
      spread: 0,
      agreement: "unanimous" as const,
      consensusScore: overall,
    },
    trajectory: {
      modelScores: { claude: overall, gpt4o: overall, gemini: overall },
      spread: 0,
      agreement: "unanimous" as const,
      consensusScore: overall,
    },
    domain: {
      modelScores: { claude: overall, gpt4o: overall, gemini: overall },
      spread: 0,
      agreement: "unanimous" as const,
      consensusScore: overall,
    },
    seniority: {
      modelScores: { claude: overall, gpt4o: overall, gemini: overall },
      spread: 0,
      agreement: "unanimous" as const,
      consensusScore: overall,
    },
    tenure: {
      modelScores: { claude: overall, gpt4o: overall, gemini: overall },
      spread: 0,
      agreement: "unanimous" as const,
      consensusScore: overall,
    },
  };

  return {
    id: `seed-${index}-${seed.candidate_filename}-${seed.scenario_label}`,
    candidateFilename: seed.candidate_filename,
    scenarioLabel: seed.scenario_label,
    scenarioNumber: 0,
    configurationId: configurationIdFromRoles(
      seed.model_extractor,
      seed.model_advocate,
      seed.model_scorer,
    ),
    configurationLabel: configurationLabelFromRoles(
      seed.model_extractor,
      seed.model_advocate,
      seed.model_scorer,
    ),
    roleAssignment,
    overallConsensusScore: overall,
    dimensions,
    overallOnly: true,
    source: "seed",
  };
}

export function parseScoringRunRow(row: Record<string, unknown>): ScoringRun {
  return {
    id: String(row.id),
    candidate_filename: String(row.candidate_filename),
    scenario_label: String(row.scenario_label),
    model_extractor: String(row.model_extractor),
    model_advocate: String(row.model_advocate),
    model_scorer: String(row.model_scorer),
    overall_score: Number(row.overall_score),
    dimension_scores: (row.dimension_scores as ScoringRun["dimension_scores"]) ?? null,
    per_model_scores: (row.per_model_scores as ScoringRun["per_model_scores"]) ?? null,
    confidence_levels:
      (row.confidence_levels as ScoringRun["confidence_levels"]) ?? null,
    spreads: (row.spreads as ScoringRun["spreads"]) ?? null,
    created_at: String(row.created_at),
  };
}

export function buildAnalysisEntriesFromRuns(
  runs: ScoringRun[],
): AnalysisRunEntry[] {
  const preliminary = runs
    .map((run) => scoringRunToAnalysisEntry(run, 0))
    .filter((e): e is AnalysisRunEntry => e != null);
  return assignScenarioNumbers(preliminary);
}

export function buildAnalysisEntriesWithHistoricalSeeds(
  dbRuns: ScoringRun[],
): AnalysisRunEntry[] {
  const fromDb = buildAnalysisEntriesFromRuns(dbRuns);
  const seeds = getHistoricalSeedRuns()
    .map((s, i) => seedInsertToAnalysisEntry(s, i))
    .filter((e): e is AnalysisRunEntry => e != null);
  const seeded = assignScenarioNumbers(seeds);
  return mergeAnalysisEntries(seeded, fromDb);
}
