"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, Loader2 } from "lucide-react";
import { VerdictBadge } from "@/components/candidates/profile-shared";
import { karta } from "@/lib/brand/karta";
import { formatInsightsText } from "@/lib/pipeline/insights-from-score";
import {
  buildPipelineWorkbook,
  downloadPipelineExcel,
} from "@/lib/pipeline/export-excel";
import type { PipelineCandidateRow, PipelineRoleSection } from "@/types/pipeline";
import type { TitleBand } from "@/types/role-brief";

function EditableCell({
  value,
  onSave,
  placeholder,
}: {
  value: string | null;
  onSave: (next: string) => Promise<void>;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const commit = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        disabled={saving}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit();
          if (e.key === "Escape") {
            setDraft(value ?? "");
            setEditing(false);
          }
        }}
        className={`w-full min-w-[7rem] ${karta.input} py-1 text-sm`}
        placeholder={placeholder}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="w-full min-h-[1.75rem] rounded px-1 py-0.5 text-left text-sm text-slate-700 hover:bg-slate-50"
    >
      {value?.trim() ? value : (
        <span className="text-slate-400">{placeholder ?? "—"}</span>
      )}
    </button>
  );
}

type JobShortlistTabProps = {
  jobId: string;
  jobTitle: string;
  titleBand: TitleBand | null;
};

export function JobShortlistTab({
  jobId,
  jobTitle,
  titleBand,
}: JobShortlistTabProps) {
  const [section, setSection] = useState<PipelineRoleSection | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    void load();
  }, [load]);

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

  const handleExport = async () => {
    if (!section) return;
    setExporting(true);
    try {
      const wb = await buildPipelineWorkbook([section]);
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

  const rows = section?.candidates ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <p className={`${karta.card} px-6 py-12 text-center text-sm text-[#64748B]`}>
          No candidates on the shortlist yet. Score applicants and add them from the
          talent pool.
        </p>
      ) : (
        <div className={`overflow-x-auto ${karta.card}`}>
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Name</th>
                <th className="min-w-[180px] px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Location</th>
                <th className="max-w-[12rem] px-4 py-3">Insights</th>
                <th className="px-4 py-3">Match</th>
                <th className="px-4 py-3">Relocation</th>
                <th className="px-4 py-3">Present CTC</th>
                <th className="px-4 py-3">Expected CTC</th>
                <th className="px-4 py-3">Recruiter Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/talent-pool?open=${encodeURIComponent(row.candidate_id)}`}
                      className="hover:underline"
                    >
                      {row.candidate_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.email ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.location ?? "—"}</td>
                  <td className="max-w-[14rem] px-4 py-3 text-xs text-slate-600">
                    {formatInsightsText(row.insights) || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <VerdictBadge
                      verdict={row.fit_verdict}
                      score={row.fit_score}
                      showScore
                    />
                  </td>
                  <td className="px-4 py-2">
                    <EditableCell
                      value={row.relocation}
                      placeholder="Relocation"
                      onSave={(v) => patchRow(row.id, "relocation", v)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <EditableCell
                      value={row.present_salary}
                      placeholder="Present CTC"
                      onSave={(v) => patchRow(row.id, "present_salary", v)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <EditableCell
                      value={row.expected_salary}
                      placeholder="Expected CTC"
                      onSave={(v) => patchRow(row.id, "expected_salary", v)}
                    />
                  </td>
                  <td className="px-4 py-2 min-w-[10rem]">
                    <EditableCell
                      value={row.recruiter_notes}
                      placeholder="Notes"
                      onSave={(v) => patchRow(row.id, "recruiter_notes", v)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
