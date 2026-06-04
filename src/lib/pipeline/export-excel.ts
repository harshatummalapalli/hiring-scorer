import * as XLSX from "xlsx-js-style";
import { topWatchPoint } from "@/lib/pipeline/insights-from-score";
import {
  legacyPipelineExportHeaders,
  legacyPipelineExportRow,
  shortlistCellExportValue,
} from "@/lib/shortlist/export-cell-value";
import { visibleShortlistColumns } from "@/lib/shortlist/resolve-columns";
import type { ShortlistColumn } from "@/lib/shortlist/default-columns";
import type { PipelineRoleSection } from "@/types/pipeline";
import type { CandidateScoreResult, FitVerdict } from "@/types/score";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const VERDICT_FILL: Record<FitVerdict, string> = {
  "EXCEPTIONAL MATCH": "E9D5FF",
  "STRONG MATCH": "C6EFCE",
  "POTENTIAL MATCH": "FFEB9C",
  "WEAK MATCH": "FED7AA",
  "NOT A MATCH": "FFC7CE",
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

  let supabase;
  try {
    supabase = createSupabaseBrowserClient();
  } catch {
    return map;
  }
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

export type BuildPipelineWorkbookOptions = {
  columns?: ShortlistColumn[];
};

export async function buildPipelineWorkbook(
  sections: PipelineRoleSection[],
  options?: BuildPipelineWorkbookOptions,
): Promise<XLSX.WorkBook> {
  const wb = XLSX.utils.book_new();
  const visibleColumns = options?.columns
    ? visibleShortlistColumns(options.columns)
    : null;

  const header = visibleColumns
    ? visibleColumns.map((c) => c.label)
    : legacyPipelineExportHeaders();

  for (const section of sections) {
    if (section.candidates.length === 0) continue;

    const watchByCandidate = visibleColumns
      ? null
      : await loadWatchPoints(
          section.candidates.map((c) => c.candidate_id),
          section.role_brief_id,
        );

    const rows: (string | number)[][] = [header];
    for (const c of section.candidates) {
      if (visibleColumns) {
        rows.push(
          visibleColumns.map((col) => shortlistCellExportValue(c, col)),
        );
      } else {
        rows.push(
          legacyPipelineExportRow(
            c,
            watchByCandidate?.get(c.candidate_id) ?? "",
          ),
        );
      }
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

    if (!visibleColumns) {
      for (let r = 1; r <= range.e.r; r++) {
        const verdictCell = XLSX.utils.encode_cell({ r, c: 5 });
        const verdict = String(ws[verdictCell]?.v ?? "") as FitVerdict;
        const fill = VERDICT_FILL[verdict];
        if (fill && ws[verdictCell]) {
          ws[verdictCell].s = { fill: { fgColor: { rgb: fill } } };
        }
      }
    } else {
      const matchIdx = visibleColumns.findIndex((col) => col.id === "match");
      if (matchIdx >= 0) {
        for (let r = 1; r <= range.e.r; r++) {
          const cell = XLSX.utils.encode_cell({ r, c: matchIdx });
          const text = String(ws[cell]?.v ?? "");
          const verdict = text.split(" · ")[0] as FitVerdict;
          const fill = VERDICT_FILL[verdict];
          if (fill && ws[cell]) {
            ws[cell].s = { fill: { fgColor: { rgb: fill } } };
          }
        }
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
    const emptyCols = header.length;
    const ws = XLSX.utils.aoa_to_sheet([
      header,
      [
        "No candidates in pipeline yet",
        ...Array(Math.max(0, emptyCols - 1)).fill(""),
      ],
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
