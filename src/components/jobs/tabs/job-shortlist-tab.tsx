"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { CandidateIdentityCard } from "@/components/candidates/candidate-identity-card";
import { VerdictBadge } from "@/components/candidates/profile-shared";
import type { Job } from "@/types/job";
import { EmptyState } from "@/components/ui/empty-state";
import { karta } from "@/lib/brand/karta";
import { formatInsightsText } from "@/lib/pipeline/insights-from-score";
import {
  buildPipelineWorkbook,
  downloadPipelineExcel,
} from "@/lib/pipeline/export-excel";
import { CandidatePitchCard } from "@/components/pipeline/candidate-pitch-card";
import type { CandidateRoleFitScore } from "@/types/candidate";
import { pickDefaultScoreId } from "@/lib/candidates/pick-panel-score";
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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [scoresByCandidateId, setScoresByCandidateId] = useState<
    Map<string, CandidateRoleFitScore | null>
  >(new Map());

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

  useEffect(() => {
    if (rows.length === 0) {
      setScoresByCandidateId(new Map());
      return;
    }
    let cancelled = false;
    void (async () => {
      const next = new Map<string, CandidateRoleFitScore | null>();
      await Promise.all(
        rows.map(async (row) => {
          try {
            const res = await fetch(
              `/api/candidates/${encodeURIComponent(row.candidate_id)}`,
            );
            const json = await res.json();
            if (!res.ok) return;
            const fits = (json.candidate?.role_fit_scores ??
              []) as CandidateRoleFitScore[];
            const fitId = pickDefaultScoreId(fits, jobId);
            const fit =
              fits.find((f) => f.id === fitId) ??
              fits.find((f) => f.role_brief_id === jobId) ??
              fits[0] ??
              null;
            next.set(row.candidate_id, fit);
          } catch {
            next.set(row.candidate_id, null);
          }
        }),
      );
      if (!cancelled) setScoresByCandidateId(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [rows, jobId]);

  const togglePitch = (candidateId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      return next;
    });
  };

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
        <EmptyState
          illustration="people"
          heading="Shortlist is empty"
          subtitle="Evaluate applicants and add strong matches from the Assessed tab or talent pool."
        />
      ) : (
        <div className={`overflow-x-auto ${karta.card}`}>
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className={karta.tableHeadRow}>
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
              {rows.map((row) => {
                const pitchExpanded = expandedIds.has(row.candidate_id);
                const fitScore =
                  scoresByCandidateId.get(row.candidate_id) ?? null;
                return (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-4 py-3 align-top">
                    <CandidateIdentityCard
                      displayName={row.candidate_name}
                      candidateId={row.candidate_id}
                      panelOptions={panelOptions}
                      showMetaRow={false}
                    />
                    <button
                      type="button"
                      onClick={() => togglePitch(row.candidate_id)}
                      className="mt-2 cursor-pointer text-xs text-[#0D9488] hover:underline"
                    >
                      {pitchExpanded
                        ? "▾ Hide summary"
                        : "▸ View pitch summary"}
                    </button>
                    {pitchExpanded && (
                      <div className="mt-3 max-w-md">
                        <CandidatePitchCard
                          candidate={row}
                          score={fitScore}
                        />
                      </div>
                    )}
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
              );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
