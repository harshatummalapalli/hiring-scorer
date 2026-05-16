"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Download,
  Loader2,
  Search,
  Trash2,
} from "lucide-react";
import { SavedScoreDetailModal } from "@/components/saved-scores/saved-score-detail-modal";
import { getErrorMessage } from "@/lib/errors";
import { snapshotToRoleBrief } from "@/lib/saved-scores/build-save-payload";
import { CONFIDENCE_FILTER_OPTIONS } from "@/lib/saved-scores/confidence-badge";
import {
  confidenceBadgeClass,
  toRecruiterConfidenceLabel,
} from "@/lib/scoring/recruiter-labels";
import { downloadSavedScoresCsv } from "@/lib/saved-scores/export-csv";
import { normalizeStoredOverallScore } from "@/lib/saved-scores/normalize-score";
import { reconstructCandidateResult } from "@/lib/saved-scores/reconstruct-result";
import { createSupabaseClient } from "@/lib/supabase/client";
import { SCORE_TAGS } from "@/types/score";
import type { SavedScoreRow, SavedScoreSort } from "@/types/saved-score";

function parseSavedScoreRow(row: Record<string, unknown>): SavedScoreRow {
  return {
    id: String(row.id),
    candidate_filename: row.candidate_filename as string | null,
    role_brief_id: row.role_brief_id as string | null,
    role_brief_title: row.role_brief_title as string | null,
    overall_score:
      row.overall_score != null ? Number(row.overall_score) : null,
    confidence_level: row.confidence_level as string | null,
    dimension_scores: row.dimension_scores as SavedScoreRow["dimension_scores"],
    green_flags: row.green_flags as SavedScoreRow["green_flags"],
    watch_signals: row.watch_signals as SavedScoreRow["watch_signals"],
    review_flags: row.review_flags as SavedScoreRow["review_flags"],
    tag: row.tag as string | null,
    recruiter_notes: row.recruiter_notes as string | null,
    score_snapshot: row.score_snapshot as SavedScoreRow["score_snapshot"],
    role_brief_snapshot:
      row.role_brief_snapshot as SavedScoreRow["role_brief_snapshot"],
    created_at: String(row.created_at),
  };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function SavedScoresManager() {
  const [rows, setRows] = useState<SavedScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [confidenceFilter, setConfidenceFilter] = useState("");
  const [sort, setSort] = useState<SavedScoreSort>("date-desc");

  const [detailId, setDetailId] = useState<string | null>(null);

  const fetchScores = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("saved_scores")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setRows((data ?? []).map((r) => parseSavedScoreRow(r as Record<string, unknown>)));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load saved scores"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchScores();
  }, [fetchScores]);

  const roleBriefOptions = useMemo(() => {
    const titles = new Set<string>();
    for (const r of rows) {
      if (r.role_brief_title) titles.add(r.role_brief_title);
    }
    return [...titles].sort();
  }, [rows]);

  const tagOptions = useMemo(() => {
    const tags = new Set<string>();
    for (const r of rows) {
      if (r.tag) tags.add(r.tag);
    }
    return [...tags].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    let list = [...rows];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) =>
        (r.candidate_filename ?? "").toLowerCase().includes(q),
      );
    }
    if (roleFilter) {
      list = list.filter((r) => r.role_brief_title === roleFilter);
    }
    if (tagFilter) {
      list = list.filter((r) => r.tag === tagFilter);
    }
    if (confidenceFilter) {
      list = list.filter(
        (r) => toRecruiterConfidenceLabel(r.confidence_level) === confidenceFilter,
      );
    }

    list.sort((a, b) => {
      const scoreA = normalizeStoredOverallScore(
        a.overall_score,
        a.dimension_scores,
      );
      const scoreB = normalizeStoredOverallScore(
        b.overall_score,
        b.dimension_scores,
      );
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();

      switch (sort) {
        case "score-desc":
          return scoreB - scoreA;
        case "score-asc":
          return scoreA - scoreB;
        case "date-asc":
          return dateA - dateB;
        case "date-desc":
        default:
          return dateB - dateA;
      }
    });

    return list;
  }, [rows, search, roleFilter, tagFilter, confidenceFilter, sort]);

  const detailRow = useMemo(
    () => rows.find((r) => r.id === detailId) ?? null,
    [rows, detailId],
  );

  const detailResult = detailRow
    ? reconstructCandidateResult(detailRow)
    : null;
  const detailRoleBrief = detailRow
    ? snapshotToRoleBrief(
        detailRow.role_brief_snapshot,
        detailRow.role_brief_title,
        detailRow.role_brief_id,
      )
    : null;

  const updateRow = async (
    id: string,
    patch: Partial<Pick<SavedScoreRow, "tag" | "recruiter_notes">>,
  ) => {
    const supabase = createSupabaseClient();
    const { error: updateError } = await supabase
      .from("saved_scores")
      .update(patch)
      .eq("id", id);
    if (updateError) throw updateError;
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Delete this saved score? This cannot be undone.")) {
      return;
    }
    setDeletingId(id);
    try {
      const supabase = createSupabaseClient();
      const { error: deleteError } = await supabase
        .from("saved_scores")
        .delete()
        .eq("id", id);
      if (deleteError) throw deleteError;
      setRows((prev) => prev.filter((r) => r.id !== id));
      if (detailId === id) setDetailId(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete score"));
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        <span className="text-sm">Loading saved scores…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm sm:col-span-2 lg:col-span-1">
            <span className="mb-1 block font-medium text-slate-700">Search</span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Candidate filename…"
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"
              />
            </div>
          </label>

          <FilterSelect
            label="Role brief"
            value={roleFilter}
            onChange={setRoleFilter}
            options={[
              { value: "", label: "All role briefs" },
              ...roleBriefOptions.map((t) => ({ value: t, label: t })),
            ]}
          />

          <FilterSelect
            label="Tag"
            value={tagFilter}
            onChange={setTagFilter}
            options={[
              { value: "", label: "All tags" },
              ...tagOptions.map((t) => ({ value: t, label: t })),
              ...SCORE_TAGS.filter((t) => !tagOptions.includes(t)).map((t) => ({
                value: t,
                label: t,
              })),
            ]}
          />

          <FilterSelect
            label="Confidence"
            value={confidenceFilter}
            onChange={setConfidenceFilter}
            options={CONFIDENCE_FILTER_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="font-medium text-slate-700">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SavedScoreSort)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            >
              <option value="date-desc">Date scored (newest)</option>
              <option value="date-asc">Date scored (oldest)</option>
              <option value="score-desc">Score (high to low)</option>
              <option value="score-asc">Score (low to high)</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => downloadSavedScoresCsv(filtered)}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV ({filtered.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-6 py-16 text-center text-sm text-slate-500">
          {rows.length === 0
            ? "No saved scores yet. Score a candidate and click Save to Supabase."
            : "No scores match your filters."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Role brief</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Confidence</th>
                  <th className="px-4 py-3">Tag</th>
                  <th className="px-4 py-3">Recruiter notes</th>
                  <th className="px-4 py-3">Date scored</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const overall = normalizeStoredOverallScore(
                    row.overall_score,
                    row.dimension_scores,
                  );
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setDetailId(row.id)}
                      className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {row.candidate_filename ?? "—"}
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3 text-slate-600">
                        {row.role_brief_title ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-lg font-bold tabular-nums text-slate-900">
                        {overall}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${confidenceBadgeClass(row.confidence_level)}`}
                        >
                          {toRecruiterConfidenceLabel(row.confidence_level)}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={row.tag ?? ""}
                          onChange={async (e) => {
                            const tag = e.target.value || null;
                            try {
                              await updateRow(row.id, { tag });
                            } catch (err) {
                              setError(
                                getErrorMessage(err, "Failed to update tag"),
                              );
                            }
                          }}
                          className="max-w-[140px] rounded-lg border border-slate-200 px-2 py-1 text-xs"
                        >
                          <option value="">No tag</option>
                          {SCORE_TAGS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          defaultValue={row.recruiter_notes ?? ""}
                          placeholder="Add notes…"
                          onBlur={async (e) => {
                            const notes = e.target.value.trim() || null;
                            if (notes === (row.recruiter_notes ?? null)) return;
                            try {
                              await updateRow(row.id, {
                                recruiter_notes: notes,
                              });
                            } catch (err) {
                              setError(
                                getErrorMessage(
                                  err,
                                  "Failed to update notes",
                                ),
                              );
                            }
                          }}
                          className="w-full min-w-[160px] rounded-lg border border-slate-200 px-2 py-1 text-xs"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                        {formatDate(row.created_at)}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => void handleDelete(row.id, e)}
                          disabled={deletingId === row.id}
                          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          aria-label="Delete saved score"
                        >
                          {deletingId === row.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {detailRow && detailResult && detailRoleBrief && (
        <SavedScoreDetailModal
          open
          onClose={() => setDetailId(null)}
          candidateFilename={detailRow.candidate_filename ?? "Candidate"}
          roleBriefTitle={detailRow.role_brief_title ?? "Role brief"}
          result={detailResult}
          roleBrief={detailRoleBrief}
        />
      )}

      {detailRow && !detailResult && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This saved score has no full snapshot. Re-save from the scorer after
          updating the database (
          <code className="text-xs">supabase/saved_scores_snapshot.sql</code>
          ).
          <button
            type="button"
            onClick={() => setDetailId(null)}
            className="ml-2 underline"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.value || "__all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
