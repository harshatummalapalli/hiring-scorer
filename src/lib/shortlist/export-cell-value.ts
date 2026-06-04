import type { ShortlistColumn } from "@/lib/shortlist/default-columns";
import { formatInsightsText } from "@/lib/pipeline/insights-from-score";
import type { PipelineCandidateRow } from "@/types/pipeline";

export function shortlistCellExportValue(
  row: PipelineCandidateRow,
  col: ShortlistColumn,
): string | number {
  if (col.type === "custom") {
    const custom = row.custom_fields ?? {};
    const v = custom[col.id];
    return v != null ? String(v) : "";
  }

  switch (col.id) {
    case "candidate_name":
      return row.candidate_name;
    case "email":
      return row.email ?? "";
    case "phone":
      return row.phone ?? "";
    case "location":
      return row.location ?? "";
    case "match": {
      const parts = [row.fit_verdict, row.fit_score].filter(
        (x) => x != null && x !== "",
      );
      return parts.join(" · ");
    }
    case "relocation":
      return row.relocation ?? "";
    case "present_salary":
      return row.present_salary ?? "";
    case "expected_salary":
      return row.expected_salary ?? "";
    case "recruiter_notes":
      return row.recruiter_notes ?? "";
    default:
      return "";
  }
}

/** Legacy pipeline export (includes insights / watch points). */
export function legacyPipelineExportHeaders(): string[] {
  return [
    "Name",
    "Email",
    "Phone",
    "Location",
    "Fit Score",
    "Verdict",
    "Key Strengths",
    "Watch Points",
    "Relocation",
    "Current salary",
    "Expected salary",
    "Recruiter Notes",
  ];
}

export function legacyPipelineExportRow(
  row: PipelineCandidateRow,
  watchPoint: string,
): (string | number)[] {
  return [
    row.candidate_name,
    row.email ?? "",
    row.phone ?? "",
    row.location ?? "",
    row.fit_score ?? "",
    row.fit_verdict ?? "",
    formatInsightsText(row.insights),
    watchPoint,
    row.relocation ?? "",
    row.present_salary ?? "",
    row.expected_salary ?? "",
    row.recruiter_notes ?? "",
  ];
}
