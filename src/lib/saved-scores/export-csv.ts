import type { DimensionKey } from "@/types/score";
import { DIMENSION_LABELS } from "@/types/score";
import type { SavedScoreRow } from "@/types/saved-score";
import { normalizeStoredOverallScore } from "@/lib/saved-scores/normalize-score";
import { toRecruiterConfidenceLabel } from "@/lib/scoring/recruiter-labels";

const DIMENSION_KEYS: DimensionKey[] = [
  "skills",
  "trajectory",
  "domain",
  "seniority",
  "tenure",
];

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function dimScore(row: SavedScoreRow, key: DimensionKey): string {
  const fromDims = row.dimension_scores?.[key]?.score;
  if (typeof fromDims === "number" && !Number.isNaN(fromDims)) {
    return String(Math.round(fromDims));
  }
  const fromSnapshot = row.score_snapshot?.dimension_scores?.[key]?.score;
  if (typeof fromSnapshot === "number" && !Number.isNaN(fromSnapshot)) {
    return String(Math.round(fromSnapshot));
  }
  return "";
}

export function buildSavedScoresCsv(rows: SavedScoreRow[]): string {
  const headers = [
    "candidate filename",
    "role brief",
    "overall score",
    "model agreement",
    "skills match score",
    "career trajectory score",
    "domain expertise score",
    "seniority fit score",
    "tenure stability score",
    "tag",
    "recruiter notes",
    "date scored",
  ];

  const lines = [headers.join(",")];

  for (const row of rows) {
    const overall = normalizeStoredOverallScore(
      row.overall_score,
      row.dimension_scores,
    );
    const values = [
      row.candidate_filename ?? "",
      row.role_brief_title ?? "",
      String(overall),
      toRecruiterConfidenceLabel(row.confidence_level),
      dimScore(row, "skills"),
      dimScore(row, "trajectory"),
      dimScore(row, "domain"),
      dimScore(row, "seniority"),
      dimScore(row, "tenure"),
      row.tag ?? "",
      row.recruiter_notes ?? "",
      row.created_at
        ? new Date(row.created_at).toISOString()
        : "",
    ];
    lines.push(values.map((v) => escapeCsv(v)).join(","));
  }

  void DIMENSION_LABELS;
  return lines.join("\r\n");
}

export function downloadSavedScoresCsv(rows: SavedScoreRow[], filename?: string): void {
  const csv = buildSavedScoresCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    filename ??
    `saved-scores-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
