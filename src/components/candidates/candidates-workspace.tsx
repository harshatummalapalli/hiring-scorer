"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Loader2,
  Search,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useActiveRoleBrief } from "@/contexts/active-role-brief-context";
import {
  getScoreForRole,
  isScoredForRole,
} from "@/lib/candidates/active-role-score";
import { getErrorMessage } from "@/lib/errors";
import { submitCandidateWithResume } from "@/lib/candidates/submit-candidate-upload";
import { parseResumeFile } from "@/lib/resume/parse-resume";
import { createSupabaseClient } from "@/lib/supabase/client";
import type {
  CandidateListItem,
  CandidatePoolFilter,
} from "@/types/candidate";
import type { RoleBrief } from "@/types/role-brief";
import { karta } from "@/lib/brand/karta";
import { VerdictBadge } from "./profile-shared";
import { CandidateSlidePanel } from "./candidate-slide-panel";

function experienceLabel(candidate: CandidateListItem): string {
  const t = candidate.signal_profile.total_years_experience?.trim();
  if (!t || t === "0") return "—";
  return t;
}

const TABS: { id: CandidatePoolFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "scored", label: "Matched" },
  { id: "unscored", label: "Not Matched Yet" },
];

export function CandidatesWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeBriefId, hydrated, setActiveBrief, syncActiveBriefFromList } =
    useActiveRoleBrief();
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [roleBriefs, setRoleBriefs] = useState<RoleBrief[]>([]);
  const [activeBrief, setActiveBriefLocal] = useState<RoleBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingBriefs, setLoadingBriefs] = useState(true);

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<CandidatePoolFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panelId, setPanelId] = useState<string | null>(null);
  const [panelRefresh, setPanelRefresh] = useState(0);

  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [pickerBriefId, setPickerBriefId] = useState("");

  const [scoringIds, setScoringIds] = useState<Set<string>>(new Set());
  const [scoringAll, setScoringAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openFromUrl = searchParams.get("open");

  useEffect(() => {
    if (openFromUrl) setPanelId(openFromUrl);
  }, [openFromUrl]);

  const setPanel = (id: string | null) => {
    setPanelId(id);
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("open", id);
    else params.delete("open");
    const qs = params.toString();
    router.replace(qs ? `/candidates?${qs}` : "/candidates", { scroll: false });
  };

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/candidates");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setCandidates(json.candidates as CandidateListItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBriefs = useCallback(async () => {
    if (!hydrated) return;
    setLoadingBriefs(true);
    try {
      const supabase = createSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("role_briefs")
        .select("*")
        .order("created_at", { ascending: false });
      if (fetchError) throw fetchError;
      const briefs = (data ?? []) as RoleBrief[];
      setRoleBriefs(briefs);
      syncActiveBriefFromList(briefs);
      if (briefs.length === 0) {
        setActiveBriefLocal(null);
        return;
      }
      const matched = activeBriefId
        ? briefs.find((b) => b.id === activeBriefId)
        : undefined;
      const pick = matched ?? briefs[0]!;
      setActiveBrief(pick);
      setActiveBriefLocal(pick);
      setPickerBriefId(pick.id);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load role briefs"));
    } finally {
      setLoadingBriefs(false);
    }
  }, [activeBriefId, hydrated, setActiveBrief, syncActiveBriefFromList]);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  useEffect(() => {
    void loadBriefs();
  }, [loadBriefs]);

  const roleId = activeBrief?.id ?? null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates.filter((c) => {
      if (tab === "scored" && !isScoredForRole(c, roleId)) return false;
      if (tab === "unscored" && isScoredForRole(c, roleId)) return false;
      if (q) {
        const name = c.display_name.toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [candidates, search, tab, roleId]);

  const unscoredCount = useMemo(
    () => candidates.filter((c) => !isScoredForRole(c, roleId)).length,
    [candidates, roleId],
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  const scoreCandidate = async (candidateId: string) => {
    if (!roleId) {
      setError("Select an active role brief before scoring.");
      return;
    }
    setScoringIds((prev) => new Set(prev).add(candidateId));
    setError(null);
    const startedAt = Date.now();
    try {
      const res = await fetch(`/api/candidates/${candidateId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleBriefId: roleId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Matching failed");
      await loadCandidates();
      if (panelId === candidateId) setPanelRefresh((k) => k + 1);
    } catch (err) {
      setError(getErrorMessage(err, "Matching failed"));
    } finally {
      setScoringIds((prev) => {
        const next = new Set(prev);
        next.delete(candidateId);
        return next;
      });
    }
  };

  const scoreMany = async (ids: string[]) => {
    for (const id of ids) {
      await scoreCandidate(id);
    }
  };

  const handleScoreAll = async () => {
    if (!roleId) return;
    const ids = candidates
      .filter((c) => !isScoredForRole(c, roleId))
      .map((c) => c.id);
    if (ids.length === 0) return;
    setScoringAll(true);
    try {
      await scoreMany(ids);
    } finally {
      setScoringAll(false);
    }
  };

  const handleScoreSelected = async () => {
    const ids = Array.from(selected).filter(
      (id) => !isScoredForRole(candidates.find((c) => c.id === id)!, roleId),
    );
    if (ids.length === 0) {
      const rescored = Array.from(selected);
      if (rescored.length > 0) await scoreMany(rescored);
      return;
    }
    await scoreMany(ids);
    setSelected(new Set());
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const resumeText = await parseResumeFile(file);
        const res = await submitCandidateWithResume({
          resumeText,
          resumeFilename: file.name,
          resumeFile: file,
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(
            json.hint
              ? `${json.error} ${json.hint}`
              : (json.error ?? "Upload failed"),
          );
        }
      }
      setShowUpload(false);
      await loadCandidates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const applyRoleChange = () => {
    const brief = roleBriefs.find((b) => b.id === pickerBriefId);
    if (brief) {
      setActiveBrief(brief);
      setActiveBriefLocal(brief);
    }
    setShowRolePicker(false);
  };

  const busy = uploading || scoringAll || scoringIds.size > 0;

  if (!hydrated || loadingBriefs) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (roleBriefs.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-6 py-10 text-center">
        <AlertCircle className="mx-auto mb-2 h-8 w-8 text-amber-600" />
        <p className="font-medium text-amber-900">No job roles yet</p>
        <p className="mt-1 text-sm text-amber-800">
          Add your first job role to get started — paste a JD and Karta will break
          it down instantly.
        </p>
        <Link
          href="/role-briefs"
          className="mt-4 inline-block text-sm font-semibold text-amber-900 underline"
        >
          Go to Job Roles
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={karta.pageTitle}>Candidates</h1>
          <p className="mt-1 text-[15px] text-[#64748B]">
            Upload resumes and match them against your active job role.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowUpload((s) => !s)}
            className={`inline-flex items-center gap-1.5 ${karta.btnPrimary}`}
          >
            <Upload className="h-4 w-4" />
            Upload Resumes
          </button>
          <button
            type="button"
            disabled={busy || unscoredCount === 0 || !roleId}
            onClick={() => void handleScoreAll()}
            className={`inline-flex items-center gap-1.5 ${karta.btnOutlineTeal}`}
          >
            {scoringAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Match All
            {unscoredCount > 0 && (
              <span className="text-slate-300">({unscoredCount})</span>
            )}
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span>Matching against:</span>
        {showRolePicker ? (
          <>
            <select
              value={pickerBriefId}
              onChange={(e) => setPickerBriefId(e.target.value)}
              className="max-w-xs rounded border border-slate-300 px-2 py-1 text-slate-900"
            >
              {roleBriefs.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                  {b.title_band ? ` · ${b.title_band}` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={applyRoleChange}
              className="rounded bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => setShowRolePicker(false)}
              className="text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <span className="font-medium text-[#1E293B]">
              {activeBrief?.title ?? "—"}
              {activeBrief?.title_band ? ` · ${activeBrief.title_band}` : ""}
            </span>
            <button
              type="button"
              onClick={() => {
                setPickerBriefId(activeBrief?.id ?? "");
                setShowRolePicker(true);
              }}
              className="text-[13px] font-medium text-[#0D9488] underline hover:no-underline"
            >
              Change
            </button>
          </>
        )}
      </div>

      {showUpload && (
        <div className="mb-4 rounded border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase text-slate-500">
              Upload
            </span>
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <label
            className={`flex cursor-pointer flex-col items-center rounded border-2 border-dashed border-slate-300 py-6 text-sm text-slate-600 hover:border-slate-400 ${uploading ? "pointer-events-none opacity-60" : ""}`}
          >
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              multiple
              className="sr-only"
              disabled={uploading}
              onChange={(e) => void handleFiles(e.target.files)}
            />
            Drop PDF, Word, or text files — or click to browse
          </label>
        </div>
      )}

      {error && (
        <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
            className="w-full rounded border border-slate-300 py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <div className="flex gap-1 rounded border border-slate-200 bg-slate-50 p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded px-3 py-1 text-sm font-medium ${
                tab === t.id
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">
          {candidates.length === 0
            ? "Upload resumes to begin — Karta matches them against your active job role."
            : "No candidates match your filters."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-slate-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={
                      filtered.length > 0 &&
                      selected.size === filtered.length
                    }
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                    className="h-4 w-4 rounded border-slate-300"
                  />
                </th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Experience</th>
                <th className="px-3 py-2">Match</th>
                <th className="px-3 py-2 w-28">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const score = getScoreForRole(c, roleId);
                const isScoring = scoringIds.has(c.id);
                return (
                  <tr
                    key={c.id}
                    className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50/80"
                    onClick={() => setPanel(c.id)}
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        aria-label={`Select ${c.display_name}`}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {c.display_name}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {experienceLabel(c)}
                    </td>
                    <td className="px-3 py-2">
                      <VerdictBadge verdict={score?.verdict ?? null} compact />
                    </td>
                    <td
                      className="px-3 py-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        disabled={isScoring || busy || !roleId}
                        onClick={() => void scoreCandidate(c.id)}
                        className="text-xs font-semibold text-slate-900 underline hover:no-underline disabled:opacity-50"
                      >
                        {isScoring ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : score ? (
                          "Re-match"
                        ) : (
                          "Match"
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white px-4 py-3 shadow-lg">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">
                {selected.size}
              </span>{" "}
              candidates selected
            </span>
            <button
              type="button"
              disabled={busy || !roleId}
              onClick={() => void handleScoreSelected()}
              className={karta.btnPrimary}
            >
              Match Selected
            </button>
          </div>
        </div>
      )}

      <CandidateSlidePanel
        key={`${panelId ?? ""}-${panelRefresh}`}
        candidateId={panelId}
        activeRoleBrief={activeBrief}
        onClose={() => setPanel(null)}
      />
    </div>
  );
}
