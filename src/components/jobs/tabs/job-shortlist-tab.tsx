"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2, Star } from "lucide-react";
import { CandidateIdentityCard } from "@/components/candidates/candidate-identity-card";
import { VerdictBadge } from "@/components/candidates/profile-shared";
import type { Job } from "@/types/job";
import { karta } from "@/lib/brand/karta";
import {
  buildPipelineWorkbook,
  downloadPipelineExcel,
} from "@/lib/pipeline/export-excel";
import type { PipelineCandidateRow, PipelineRoleSection } from "@/types/pipeline";
import type { TitleBand } from "@/types/role-brief";

/**
 * Inline-editable single-line cell (for Relocation, Present CTC, Expected CTC).
 */
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
        <span className="text-slate-300 italic">{placeholder ?? "—"}</span>
      )}
    </button>
  );
}

/**
 * Multi-line editable textarea for Recruiter Notes.
 * Pre-filled with the AI-generated summary on shortlist. Recruiter can edit freely.
 */
function EditableNotesCell({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (next: string) => Promise<void>;
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
      <div className="flex flex-col gap-1">
        <textarea
          autoFocus
          disabled={saving}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          className={`w-full min-w-[14rem] resize-y ${karta.input} py-1 text-sm font-mono leading-relaxed`}
          style={{ minHeight: "7rem" }}
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void commit()}
            className={`text-xs font-medium ${karta.btnPrimary} px-3 py-1`}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(value ?? "");
              setEditing(false);
            }}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const preview = draft.trim();
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="w-full min-h-[3.5rem] rounded px-1 py-1 text-left text-sm text-slate-700 hover:bg-slate-50 whitespace-pre-line"
      style={{ minWidth: "14rem" }}
    >
      {preview ? (
        <span className="line-clamp-4">{preview}</span>
      ) : (
        <span className="text-slate-400">Add notes…</span>
      )}
    </button>
  );
}

const SHORTLIST_COLUMN_COUNT = 9;

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
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());

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

  return (
    <div className="space-y-4">
      {/* Verify Before Submitting checklist */}
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

      <div className="flex items-center justify-between">
        {rows.length > 0 && (
          <p className="text-sm text-[#64748B]">
            <span className="font-medium text-[#1E293B]">{rows.length}</span>{" "}
            {rows.length === 1 ? "candidate" : "candidates"} shortlisted
          </p>
        )}
        <button
          type="button"
          disabled={exporting || rows.length === 0}
          onClick={() => void handleExport()}
          className={`ml-auto inline-flex items-center gap-2 ${karta.btnOutlineTeal}`}
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
        <div className={`${karta.card} px-6 py-12 text-center`}>
          <Star className="mx-auto h-10 w-10 text-amber-300" aria-hidden />
          <h2 className="mt-6 text-[18px] font-semibold text-[#1E293B]">
            Your shortlist is empty
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#64748B]">
            Evaluate candidates in the Pipeline tab and move the best ones here.
          </p>
        </div>
      ) : (
        <div className={`overflow-x-auto ${karta.card}`}>
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className={karta.tableHeadRow}>
                <th className="px-4 py-3">Candidate</th>
                <th className="min-w-[160px] px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Match</th>
                <th className="px-4 py-3">Relocation</th>
                <th className="px-4 py-3">Present CTC</th>
                <th className="px-4 py-3">Expected CTC</th>
                <th className="min-w-[240px] px-4 py-3">
                  Recruiter Summary
                  <span className="ml-1 text-[10px] font-normal text-[#64748B]">
                    (auto-filled · editable)
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 align-top">
                    <CandidateIdentityCard
                      displayName={row.candidate_name}
                      candidateId={row.candidate_id}
                      panelOptions={panelOptions}
                      compact
                      showMetaRow={false}
                      education={[]}
                      careerGaps={[]}
                      topSkills={[]}
                    />
                  </td>
                  <td className="px-4 py-3 align-top text-slate-600">
                    {row.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 align-top text-slate-600">
                    {row.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 align-top text-slate-600">
                    {row.location ?? "—"}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <VerdictBadge
                      verdict={row.fit_verdict}
                      score={row.fit_score}
                      showScore
                    />
                  </td>
                  <td className="px-4 py-2 align-top">
                    <EditableCell
                      value={row.relocation}
                      placeholder="Relocation"
                      onSave={(v) => patchRow(row.id, "relocation", v)}
                    />
                  </td>
                  <td className="px-4 py-2 align-top">
                    <EditableCell
                      value={row.present_salary}
                      placeholder="Present CTC"
                      onSave={(v) => patchRow(row.id, "present_salary", v)}
                    />
                  </td>
                  <td className="px-4 py-2 align-top">
                    <EditableCell
                      value={row.expected_salary}
                      placeholder="Expected CTC"
                      onSave={(v) => patchRow(row.id, "expected_salary", v)}
                    />
                  </td>
                  <td className="px-4 py-2 align-top">
                    <EditableNotesCell
                      value={row.recruiter_notes}
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
