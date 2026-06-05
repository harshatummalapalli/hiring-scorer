"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, ListChecks, Loader2, Settings } from "lucide-react";
import { ShortlistColumnConfigModal } from "@/components/shortlist/shortlist-column-config-modal";
import { ShortlistTableCell } from "@/components/shortlist/shortlist-table-cell";
import { DEFAULT_SHORTLIST_COLUMNS } from "@/lib/shortlist/default-columns";
import {
  resolveShortlistColumns,
  visibleShortlistColumns,
} from "@/lib/shortlist/resolve-columns";
import type { ShortlistColumn } from "@/lib/shortlist/default-columns";
import type { Job } from "@/types/job";
import { karta } from "@/lib/brand/karta";
import {
  buildPipelineWorkbook,
  downloadPipelineExcel,
} from "@/lib/pipeline/export-excel";
import type { PipelineCandidateRow, PipelineRoleSection } from "@/types/pipeline";
import type { TitleBand } from "@/types/role-brief";

type JobShortlistTabProps = {
  jobId: string;
  jobTitle: string;
  titleBand: TitleBand | null;
  roleBrief: Job;
};

export function JobShortlistTab({
  jobId,
  jobTitle,
  titleBand,
  roleBrief,
}: JobShortlistTabProps) {
  const panelOptions = useMemo(
    () => ({ contextJobId: jobId, roleBrief }),
    [jobId, roleBrief],
  );
  const [section, setSection] = useState<PipelineRoleSection | null>(null);
  const [columns, setColumns] = useState<ShortlistColumn[]>(
    DEFAULT_SHORTLIST_COLUMNS,
  );
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [showColumnConfig, setShowColumnConfig] = useState(false);

  const visibleColumns = useMemo(
    () => visibleShortlistColumns(columns),
    [columns],
  );

  const cannotAssess = roleBrief.cannot_assess ?? [];
  const totalCannotAssess = cannotAssess.length;
  const checkedCount = checked.size;

  const toggleCheck = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const loadColumns = useCallback(async () => {
    try {
      const res = await fetch("/api/workspace/settings");
      const json = await res.json();
      if (res.ok && json.shortlist_columns) {
        setColumns(resolveShortlistColumns(json.shortlist_columns));
      }
    } catch {
      setColumns(DEFAULT_SHORTLIST_COLUMNS);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/pipeline?role_brief_id=${encodeURIComponent(jobId)}`,
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load shortlist");
      const sections = json.sections as PipelineRoleSection[];
      setSection(
        sections[0] ?? {
          role_brief_id: jobId,
          title: jobTitle,
          title_band: titleBand,
          candidates: [],
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [jobId, jobTitle, titleBand]);

  useEffect(() => {
    void loadColumns();
    void load();
  }, [load, loadColumns]);

  const rows = section?.candidates ?? [];

  const patchRow = async (
    id: string,
    field: "relocation" | "present_salary" | "expected_salary" | "recruiter_notes",
    value: string,
  ) => {
    const res = await fetch(`/api/pipeline/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Update failed");
    const updated = json.row as PipelineCandidateRow;
    setSection((prev) =>
      prev
        ? {
            ...prev,
            candidates: prev.candidates.map((c) =>
              c.id === id ? updated : c,
            ),
          }
        : prev,
    );
  };

  const patchCustomField = async (
    candidateRowId: string,
    fieldId: string,
    value: string,
  ) => {
    const row = rows.find((c) => c.id === candidateRowId);
    const current = row?.custom_fields ?? {};
    const updated = { ...current, [fieldId]: value };
    const res = await fetch(`/api/pipeline/${candidateRowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ custom_fields: updated }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Update failed");
    const saved = json.row as PipelineCandidateRow;
    setSection((prev) =>
      prev
        ? {
            ...prev,
            candidates: prev.candidates.map((c) =>
              c.id === candidateRowId ? saved : c,
            ),
          }
        : prev,
    );
  };

  const handleExport = async () => {
    if (!section) return;
    setExporting(true);
    try {
      const wb = await buildPipelineWorkbook([section], { columns });
      downloadPipelineExcel([section], wb);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {totalCannotAssess > 0 && (
        <section className={`${karta.card} mb-6 p-5`}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className={karta.sectionHeading}>Verify Before Submitting</h3>
              <p className="mt-1 text-xs text-[#64748B]">
                These qualities cannot be verified from a resume. Confirm each
                before presenting this shortlist to the hiring manager.
              </p>
            </div>
            <span className="text-xs font-medium text-[#64748B]">
              {checkedCount}/{totalCannotAssess} verified
            </span>
          </div>
          <ul className="mt-4 space-y-2">
            {cannotAssess.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id={`ca-${i}`}
                  checked={checked.has(i)}
                  onChange={() => toggleCheck(i)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#0D9488]"
                />
                <label
                  htmlFor={`ca-${i}`}
                  className={`cursor-pointer text-sm ${
                    checked.has(i)
                      ? "line-through text-[#94A3B8]"
                      : "text-[#334155]"
                  }`}
                >
                  {item}
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {rows.length > 0 && (
          <p className="text-sm text-[#64748B]">
            <span className="font-medium text-[#1E293B]">{rows.length}</span>{" "}
            {rows.length === 1 ? "candidate" : "candidates"} shortlisted
          </p>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowColumnConfig(true)}
            className={`inline-flex items-center gap-2 ${karta.btnSecondary}`}
          >
            <Settings className="h-4 w-4" />
            Customize
          </button>
          <button
            type="button"
            disabled={exporting || rows.length === 0}
            onClick={() => void handleExport()}
            className={`inline-flex items-center gap-2 ${karta.btnOutlineTeal}`}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export Excel
          </button>
        </div>
      </div>

      <ShortlistColumnConfigModal
        open={showColumnConfig}
        initialColumns={columns}
        onClose={() => setShowColumnConfig(false)}
        onSaved={(saved) => setColumns(saved)}
      />

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <div className={`${karta.card} px-6 py-12 text-center`}>
          <ListChecks className="mx-auto h-12 w-12 text-slate-200" aria-hidden />
          <h2 className="mt-4 text-[18px] font-semibold text-slate-400">
            No candidates shortlisted
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-300">
            Move strong candidates here from the pipeline.
          </p>
        </div>
      ) : (
        <div className={`overflow-x-auto ${karta.card}`}>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className={karta.tableHeadRow}>
                {visibleColumns.map((col) => (
                  <th
                    key={col.id}
                    className={`px-4 py-3 ${
                      col.id === "recruiter_notes" ? "min-w-[240px]" : ""
                    } ${col.id === "email" ? "min-w-[160px]" : ""}`}
                  >
                    {col.label}
                    {col.id === "recruiter_notes" && (
                      <span className="ml-1 text-[10px] font-normal text-[#64748B]">
                        (auto-filled · editable)
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  {visibleColumns.map((col) => (
                    <td
                      key={col.id}
                      className={`px-4 py-2 align-top ${
                        col.id === "candidate_name" ? "py-3" : ""
                      }`}
                    >
                      <ShortlistTableCell
                        row={row}
                        col={col}
                        panelOptions={panelOptions}
                        onPatchSystem={patchRow}
                        onPatchCustom={patchCustomField}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
