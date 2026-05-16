"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Loader2, Search, UserPlus, X } from "lucide-react";
import { parseResumeFile } from "@/lib/resume/parse-resume";
import { stripPII } from "@/lib/resume/strip-pii";
import {
  filterCandidates,
  sortCandidates,
} from "@/lib/candidates/list-filters";
import type {
  CandidateCompanyTypeFilter,
  CandidateExperienceFilter,
  CandidateListItem,
  CandidateSortOption,
  CandidateVerdictFilter,
} from "@/types/candidate";
import { CandidateListCard } from "./candidate-list-card";

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-slate-900 text-white shadow-sm"
          : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

const VERDICT_FILTERS: { id: CandidateVerdictFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "strong", label: "Strong fit" },
  { id: "possible", label: "Possible" },
  { id: "weak", label: "Weak fit" },
  { id: "not_suitable", label: "Not suitable" },
  { id: "unscored", label: "Not scored" },
];

const COMPANY_FILTERS: { id: CandidateCompanyTypeFilter; label: string }[] = [
  { id: "all", label: "All types" },
  { id: "Product", label: "Product" },
  { id: "Services", label: "Services" },
  { id: "GCC", label: "GCC" },
  { id: "Startup", label: "Startup" },
];

const EXPERIENCE_FILTERS: {
  id: CandidateExperienceFilter;
  label: string;
}[] = [
  { id: "all", label: "Any experience" },
  { id: "0-3", label: "0–3 yrs" },
  { id: "4-7", label: "4–7 yrs" },
  { id: "8-12", label: "8–12 yrs" },
  { id: "13+", label: "13+ yrs" },
];

const SORT_OPTIONS: { id: CandidateSortOption; label: string }[] = [
  { id: "recent", label: "Most recently added" },
  { id: "highest_score", label: "Highest score" },
  { id: "most_scored", label: "Most roles scored" },
];

export function CandidatesManager() {
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [verdictFilter, setVerdictFilter] =
    useState<CandidateVerdictFilter>("all");
  const [companyFilter, setCompanyFilter] =
    useState<CandidateCompanyTypeFilter>("all");
  const [experienceFilter, setExperienceFilter] =
    useState<CandidateExperienceFilter>("all");
  const [sort, setSort] = useState<CandidateSortOption>("recent");

  const load = useCallback(async () => {
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

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const filteredList = filterCandidates(candidates, {
      search,
      verdict: verdictFilter,
      companyType: companyFilter,
      experience: experienceFilter,
    });
    return sortCandidates(filteredList, sort);
  }, [
    candidates,
    search,
    verdictFilter,
    companyFilter,
    experienceFilter,
    sort,
  ]);

  const hasActiveFilters =
    verdictFilter !== "all" ||
    companyFilter !== "all" ||
    experienceFilter !== "all" ||
    search.trim().length > 0;

  const clearFilters = () => {
    setSearch("");
    setVerdictFilter("all");
    setCompanyFilter("all");
    setExperienceFilter("all");
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const raw = await parseResumeFile(file);
        const { stripped: resumeText } = stripPII(raw);
        const res = await fetch("/api/candidates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resumeText,
            resumeFilename: file.name,
          }),
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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a1628] sm:text-3xl">
            Talent pool
          </h1>
          <p className="mt-1.5 text-slate-600">
            Browse candidates with hiring intelligence — open a profile to
            score, screen, or add notes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowUpload((s) => !s)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <UserPlus className="h-4 w-4" aria-hidden />
          Add to pool
        </button>
      </div>

      {showUpload && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Upload resume
            </h2>
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
              aria-label="Close upload"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <label
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 transition hover:border-slate-400 hover:bg-slate-100 ${uploading ? "pointer-events-none opacity-60" : ""}`}
          >
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              multiple
              className="sr-only"
              disabled={uploading}
              onChange={(e) => void handleFiles(e.target.files)}
            />
            <span className="text-sm font-medium text-slate-700">
              Drop resumes or click to browse
            </span>
          </label>
          {uploading && (
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Building profiles…
            </p>
          )}
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="relative mb-4">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or title…"
          className="w-full rounded-full border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
      </div>

      <div className="mb-3 space-y-3">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            Verdict
          </p>
          <div className="flex flex-wrap gap-2">
            {VERDICT_FILTERS.map((f) => (
              <FilterPill
                key={f.id}
                active={verdictFilter === f.id}
                onClick={() => setVerdictFilter(f.id)}
              >
                {f.label}
              </FilterPill>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            Company type
          </p>
          <div className="flex flex-wrap gap-2">
            {COMPANY_FILTERS.map((f) => (
              <FilterPill
                key={f.id}
                active={companyFilter === f.id}
                onClick={() =>
                  setCompanyFilter(f.id as CandidateCompanyTypeFilter)
                }
              >
                {f.label}
              </FilterPill>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
            Experience
          </p>
          <div className="flex flex-wrap gap-2">
            {EXPERIENCE_FILTERS.map((f) => (
              <FilterPill
                key={f.id}
                active={experienceFilter === f.id}
                onClick={() => setExperienceFilter(f.id)}
              >
                {f.label}
              </FilterPill>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {loading ? (
            "Loading…"
          ) : (
            <>
              <span className="font-semibold text-slate-900">
                {filtered.length}
              </span>
              {filtered.length === 1 ? " candidate" : " candidates"}
              {hasActiveFilters && candidates.length !== filtered.length && (
                <span className="text-slate-500">
                  {" "}
                  of {candidates.length}
                </span>
              )}
            </>
          )}
          {hasActiveFilters && !loading && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-2 font-medium text-slate-700 underline hover:text-slate-900"
            >
              Clear filters
            </button>
          )}
        </p>
        <label className="relative flex items-center gap-2 text-sm text-slate-600">
          <span className="sr-only">Sort by</span>
          <span className="hidden sm:inline">Sort by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as CandidateSortOption)}
            className="appearance-none rounded-full border border-slate-300 bg-white py-2 pl-4 pr-9 text-sm font-medium text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden
          />
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : candidates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <p className="text-slate-600">Your talent pool is empty.</p>
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="mt-4 text-sm font-semibold text-slate-900 underline"
          >
            Add your first candidate
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-12 text-center text-slate-600">
          <p>No candidates match your filters.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-3 text-sm font-semibold text-slate-900 underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((c) => (
            <li key={c.id}>
              <CandidateListCard candidate={c} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

