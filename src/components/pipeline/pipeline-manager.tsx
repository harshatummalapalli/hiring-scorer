"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import type { PipelineCandidateRow, PipelineRoleSection } from "@/types/pipeline";
import { VerdictBadge } from "@/components/candidates/profile-shared";
import { EmptyState } from "@/components/ui/empty-state";
import { karta } from "@/lib/brand/karta";
import { formatInsightsText } from "@/lib/pipeline/insights-from-score";
import { buildPipelineWorkbook, downloadPipelineExcel } from "@/lib/pipeline/export-excel";
import type { ScoredCandidateOption } from "@/types/pipeline";

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
      className="w-full text-left text-sm text-slate-700 hover:bg-slate-50 rounded px-1 py-0.5 min-h-[1.75rem]"
    >
      {value?.trim() ? value : (
        <span className="text-slate-400">{placeholder ?? "—"}</span>
      )}
    </button>
  );
}

type AddCandidateSource = "role" | "talent_pool";

function AddCandidateModal({
  roleBriefId,
  roleTitle,
  source,
  onClose,
  onAdded,
}: {
  roleBriefId: string;
  roleTitle: string;
  source: AddCandidateSource;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<ScoredCandidateOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const poolParam = source === "talent_pool" ? "&pool=any" : "";
        const res = await fetch(
          `/api/pipeline/scored-candidates?role_brief_id=${encodeURIComponent(roleBriefId)}${poolParam}`,
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load");
        setOptions(json.candidates as ScoredCandidateOption[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [roleBriefId, source]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      o.candidate_name.toLowerCase().includes(q),
    );
  }, [options, search]);

  const toggle = (id: string, disabled: boolean) => {
    if (disabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (selected.size === 0) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_brief_id: roleBriefId,
          candidate_ids: Array.from(selected),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to add");
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="add-pipeline-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 id="add-pipeline-title" className="text-lg font-semibold text-slate-900">
            {source === "talent_pool" ? "Shortlist candidates" : "Add candidate"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {roleTitle}
            {source === "talent_pool" && (
              <span className="block text-xs text-slate-500">
                Candidates scored on any role brief
              </span>
            )}
          </p>
        </div>
        <div className="border-b border-slate-200 px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidates…"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500">
              {source === "talent_pool"
                ? "No matched candidates yet. Match candidates on the Candidates page first."
                : "No matched candidates for this role yet. Match candidates against this job role first."}
            </p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((o) => {
                const disabled = o.already_in_pipeline;
                const checked = selected.has(o.candidate_id);
                return (
                  <li key={o.candidate_id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 ${
                        disabled
                          ? "cursor-not-allowed opacity-50"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={checked}
                        onChange={() => toggle(o.candidate_id, disabled)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span className="min-w-0 flex-1 font-medium text-slate-900">
                        {o.candidate_name}
                      </span>
                      <VerdictBadge
                        verdict={o.verdict}
                        score={o.overall_score}
                        compact
                      />
                      {disabled && (
                        <span className="text-xs text-slate-400">In pipeline</span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {error && (
          <p className="px-5 text-sm text-red-600">{error}</p>
        )}
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={adding || selected.size === 0}
            onClick={() => void submit()}
            className={karta.btnPrimary}
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Shortlist
          </button>
        </div>
      </div>
    </div>
  );
}

function RoleSection({
  section,
  expanded,
  onToggle,
  onPatch,
  onOpenAdd,
  onOpenTalentPool,
}: {
  section: PipelineRoleSection;
  expanded: boolean;
  onToggle: () => void;
  onPatch: (
    id: string,
    field: "relocation" | "present_salary" | "expected_salary" | "recruiter_notes",
    value: string,
  ) => Promise<void>;
  onOpenAdd: () => void;
  onOpenTalentPool: () => void;
}) {
  return (
    <section className={`overflow-hidden ${karta.card}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-slate-50"
      >
        {expanded ? (
          <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" />
        ) : (
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-500" />
        )}
        <div className="min-w-0 flex-1">
          <h2 className={karta.cardTitle}>{section.title}</h2>
          <p className="text-sm text-slate-500">
            {section.title_band ?? "Band not set"} · {section.candidates.length}{" "}
            {section.candidates.length === 1 ? "candidate" : "candidates"}
          </p>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-200">
          {section.candidates.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-10 text-center">
              <p className="text-sm text-slate-600">
                No candidates shortlisted yet
              </p>
              <button
                type="button"
                onClick={onOpenTalentPool}
                className={`mt-4 inline-flex items-center gap-2 ${karta.btnPrimary}`}
              >
                <Plus className="h-4 w-4" />
                Shortlist Candidates
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                  {section.candidates.map((row) => (
                    <PipelineTableRow key={row.id} row={row} onPatch={onPatch} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {section.candidates.length > 0 && (
            <div className="border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={onOpenAdd}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
                Add candidate
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PipelineTableRow({
  row,
  onPatch,
}: {
  row: PipelineCandidateRow;
  onPatch: (
    id: string,
    field: "relocation" | "present_salary" | "expected_salary" | "recruiter_notes",
    value: string,
  ) => Promise<void>;
}) {
  const verdict = row.fit_verdict;

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3 font-medium text-slate-900">
        <Link
          href={`/talent-pool?open=${encodeURIComponent(row.candidate_id)}`}
          className="hover:underline"
        >
          {row.candidate_name}
        </Link>
      </td>
      <td className="min-w-[180px] px-4 py-3 text-slate-600">
        {row.email?.trim() ? (
          <span
            className="block max-w-[220px] truncate"
            title={row.email}
          >
            {row.email.length > 22
              ? `${row.email.slice(0, 22)}…`
              : row.email}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-4 py-3 text-slate-600">{row.phone ?? "—"}</td>
      <td className="px-4 py-3 text-slate-600">{row.location ?? "—"}</td>
      <td className="max-w-[14rem] px-4 py-3 text-slate-600">
        <span
          className="block truncate text-xs leading-snug whitespace-nowrap"
          title={formatInsightsText(row.insights) || undefined}
        >
          {formatInsightsText(row.insights) || "—"}
        </span>
      </td>
      <td className="px-4 py-3">
        <VerdictBadge
          verdict={verdict}
          score={row.fit_score}
          showScore
        />
      </td>
      <td className="px-4 py-2">
        <EditableCell
          value={row.relocation}
          placeholder="Add relocation"
          onSave={(v) => onPatch(row.id, "relocation", v)}
        />
      </td>
      <td className="px-4 py-2">
        <EditableCell
          value={row.present_salary}
          placeholder="Present CTC"
          onSave={(v) => onPatch(row.id, "present_salary", v)}
        />
      </td>
      <td className="px-4 py-2">
        <EditableCell
          value={row.expected_salary}
          placeholder="Expected CTC"
          onSave={(v) => onPatch(row.id, "expected_salary", v)}
        />
      </td>
      <td className="px-4 py-2 min-w-[10rem]">
        <EditableCell
          value={row.recruiter_notes}
          placeholder="Notes"
          onSave={(v) => onPatch(row.id, "recruiter_notes", v)}
        />
      </td>
    </tr>
  );
}

export function PipelineManager() {
  const [sections, setSections] = useState<PipelineRoleSection[]>([]);
  const [screenedCount, setScreenedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [addModal, setAddModal] = useState<{
    role_brief_id: string;
    title: string;
    source: AddCandidateSource;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pipeline");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.hint ? `${json.error} ${json.hint}` : (json.error ?? "Failed to load"),
        );
      }
      const next = json.sections as PipelineRoleSection[];
      setSections(next);
      setScreenedCount(
        typeof json.screenedCount === "number" ? json.screenedCount : 0,
      );
      setExpanded((prev) => {
        if (prev.size > 0) return prev;
        const withCandidates = next.filter((s) => s.candidates.length > 0);
        if (withCandidates[0]) return new Set([withCandidates[0].role_brief_id]);
        if (next[0]) return new Set([next[0].role_brief_id]);
        return prev;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

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
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        candidates: s.candidates.map((c) => (c.id === id ? updated : c)),
      })),
    );
  };

  const shortlistedTotal = useMemo(
    () => sections.reduce((n, s) => n + s.candidates.length, 0),
    [sections],
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      const withCandidates = sections.filter((s) => s.candidates.length > 0);
      const wb = await buildPipelineWorkbook(withCandidates);
      downloadPipelineExcel(withCandidates, wb);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={karta.pageTitle}>Pipeline</h1>
          <p className="mt-1.5 text-[15px] text-[#64748B]">
            Shortlisted candidates organised by job role.
          </p>
        </div>
        <button
          type="button"
          disabled={exporting || loading}
          onClick={() => void handleExport()}
          className={`inline-flex shrink-0 items-center justify-center gap-2 ${karta.btnOutlineTeal}`}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Export Excel
        </button>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className={`${karta.card} p-5`}>
          <p className={karta.sectionHeading}>Active Roles</p>
          <p className="mt-2 text-3xl font-semibold text-[#0D9488]">
            {sections.length}
          </p>
        </div>
        <div className={`${karta.card} p-5`}>
          <p className={karta.sectionHeading}>Shortlisted</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-600">
            {shortlistedTotal}
          </p>
        </div>
        <div className={`${karta.card} p-5`}>
          <p className={karta.sectionHeading}>Screened</p>
          <p className="mt-2 text-3xl font-semibold text-[#64748B]">
            {screenedCount}
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : sections.length === 0 ? (
        <EmptyState
          illustration="network"
          heading="Your pipeline is empty"
          subtitle="Shortlist candidates from your talent pool or job applicants to track them here."
          action={
            <Link href="/talent-pool" className={karta.btnPrimary}>
              Go to Talent Pool
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {sections.map((section) => (
            <RoleSection
              key={section.role_brief_id}
              section={section}
              expanded={expanded.has(section.role_brief_id)}
              onToggle={() =>
                setExpanded((prev) => {
                  const next = new Set(prev);
                  if (next.has(section.role_brief_id)) {
                    next.delete(section.role_brief_id);
                  } else {
                    next.add(section.role_brief_id);
                  }
                  return next;
                })
              }
              onPatch={patchRow}
              onOpenAdd={() =>
                setAddModal({
                  role_brief_id: section.role_brief_id,
                  title: section.title,
                  source: "role",
                })
              }
              onOpenTalentPool={() =>
                setAddModal({
                  role_brief_id: section.role_brief_id,
                  title: section.title,
                  source: "talent_pool",
                })
              }
            />
          ))}
        </div>
      )}

      {addModal && (
        <AddCandidateModal
          roleBriefId={addModal.role_brief_id}
          roleTitle={addModal.title}
          source={addModal.source}
          onClose={() => setAddModal(null)}
          onAdded={() => void load()}
        />
      )}
    </div>
  );
}
