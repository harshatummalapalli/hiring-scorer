import * as XLSX from "xlsx-js-style";
import { formatInsightsText } from "@/lib/pipeline/insights-from-score";
import { topWatchPoint } from "@/lib/pipeline/insights-from-score";
import type { PipelineRoleSection } from "@/types/pipeline";
import type { CandidateScoreResult, FitVerdict } from "@/types/score";
import { createClient } from "@supabase/supabase-js";

const VERDICT_FILL: Record<FitVerdict, string> = {
  "STRONG FIT": "C6EFCE",
  "POSSIBLE FIT": "FFEB9C",
  "WEAK FIT": "FCD5B4",
  "NOT SUITABLE": "FFC7CE",
};

function sheetName(title: string): string {
  const cleaned = title.replace(/[\\/*?:\[\]]/g, "").trim();
  return cleaned.slice(0, 31) || "Role";
}

async function loadWatchPoints(
  candidateIds: string[],
  roleBriefId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (candidateIds.length === 0) return map;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!url || !key) return map;

  const supabase = createClient(url, key);
  const { data } = await supabase
    .from("saved_scores")
    .select("candidate_id, score_snapshot")
    .eq("role_brief_id", roleBriefId)
    .in("candidate_id", candidateIds);

  for (const raw of data ?? []) {
    const row = raw as { candidate_id: string; score_snapshot: unknown };
    const cid = String(row.candidate_id);
    if (map.has(cid)) continue;
    map.set(
      cid,
      topWatchPoint(row.score_snapshot as CandidateScoreResult | null),
    );
  }
  return map;
}

export async function buildPipelineWorkbook(
  sections: PipelineRoleSection[],
): Promise<XLSX.WorkBook> {
  const wb = XLSX.utils.book_new();
  const header = [
    "Name",
    "Email",
    "Phone",
    "Location",
    "Fit Score",
    "Verdict",
    "Key Strengths",
    "Watch Points",
    "Relocation",
    "Present CTC",
    "Expected CTC",
    "Recruiter Notes",
  ];

  for (const section of sections) {
    if (section.candidates.length === 0) continue;

    const watchByCandidate = await loadWatchPoints(
      section.candidates.map((c) => c.candidate_id),
      section.role_brief_id,
    );

    const rows: (string | number)[][] = [header];
    for (const c of section.candidates) {
      const strengths = formatInsightsText(c.insights);
      rows.push([
        c.candidate_name,
        c.email ?? "",
        c.phone ?? "",
        c.location ?? "",
        c.fit_score ?? "",
        c.fit_verdict ?? "",
        strengths,
        watchByCandidate.get(c.candidate_id) ?? "",
        c.relocation ?? "",
        c.present_salary ?? "",
        c.expected_salary ?? "",
        c.recruiter_notes ?? "",
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");

    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = XLSX.utils.encode_cell({ r: 0, c });
      if (!ws[cell]) continue;
      ws[cell].s = {
        fill: { fgColor: { rgb: "1F2937" } },
        font: { color: { rgb: "FFFFFF" }, bold: true },
      };
    }

    for (let r = 1; r <= range.e.r; r++) {
      const verdictCell = XLSX.utils.encode_cell({ r, c: 5 });
      const verdict = String(ws[verdictCell]?.v ?? "") as FitVerdict;
      const fill = VERDICT_FILL[verdict];
      if (fill && ws[verdictCell]) {
        ws[verdictCell].s = { fill: { fgColor: { rgb: fill } } };
      }
    }

    const colWidths = header.map((h, colIdx) => {
      let max = h.length;
      for (let r = 1; r <= range.e.r; r++) {
        const cell = XLSX.utils.encode_cell({ r, c: colIdx });
        const len = String(ws[cell]?.v ?? "").length;
        if (len > max) max = len;
      }
      return { wch: Math.min(48, Math.max(10, max + 2)) };
    });
    ws["!cols"] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, sheetName(section.title));
  }

  if (wb.SheetNames.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([
      header,
      ["No candidates in pipeline yet", "", "", "", "", "", "", "", "", "", "", ""],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Pipeline");
  }

  return wb;
}

export function downloadPipelineExcel(
  sections: PipelineRoleSection[],
  workbook: XLSX.WorkBook,
): void {
  const date = new Date().toISOString().slice(0, 10);
  const filename = `Hiring Pipeline ${date}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
