import type { ScoringRunInsert } from "@/types/scoring-run";

type HistoricalRow = {
  scenario: string;
  extractor: string;
  advocate: string;
  scorer: string;
  scores: { candidate: string; overall: number }[];
};

const HISTORICAL: HistoricalRow[] = [
  {
    scenario: "Scenario 1",
    extractor: "Claude",
    advocate: "GPT-4o",
    scorer: "Gemini Flash",
    scores: [
      { candidate: "Uday", overall: 64 },
      { candidate: "Tushar", overall: 77 },
      { candidate: "Shashank", overall: 63 },
      { candidate: "Srikrishna", overall: 71 },
    ],
  },
  {
    scenario: "Scenario 2",
    extractor: "GPT-4o",
    advocate: "Gemini Flash",
    scorer: "Claude",
    scores: [
      { candidate: "Uday", overall: 74 },
      { candidate: "Tushar", overall: 75 },
      { candidate: "Shashank", overall: 54 },
      { candidate: "Srikrishna", overall: 74 },
    ],
  },
  {
    scenario: "Scenario 3",
    extractor: "Gemini Flash",
    advocate: "Claude",
    scorer: "GPT-4o",
    scores: [
      { candidate: "Uday", overall: 73 },
      { candidate: "Tushar", overall: 76 },
      { candidate: "Shashank", overall: 51 },
      { candidate: "Srikrishna", overall: 78 },
    ],
  },
  {
    scenario: "Scenario 4",
    extractor: "GPT-4o",
    advocate: "Claude",
    scorer: "Gemini Flash",
    scores: [
      { candidate: "Uday", overall: 68 },
      { candidate: "Tushar", overall: 72 },
      { candidate: "Shashank", overall: 65 },
      { candidate: "Srikrishna", overall: 71 },
    ],
  },
];

export function getHistoricalSeedRuns(): ScoringRunInsert[] {
  const rows: ScoringRunInsert[] = [];
  for (const block of HISTORICAL) {
    for (const { candidate, overall } of block.scores) {
      rows.push({
        candidate_filename: candidate,
        scenario_label: block.scenario,
        model_extractor: block.extractor,
        model_advocate: block.advocate,
        model_scorer: block.scorer,
        overall_score: overall,
        dimension_scores: null,
        per_model_scores: null,
        confidence_levels: null,
        spreads: null,
      });
    }
  }
  return rows;
}

export const HISTORICAL_RUN_COUNT = getHistoricalSeedRuns().length;
