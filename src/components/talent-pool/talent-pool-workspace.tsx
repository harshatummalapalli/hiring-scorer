"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, Upload, X } from "lucide-react";
import { CandidateSlidePanel } from "@/components/candidates/candidate-slide-panel";
import { karta } from "@/lib/brand/karta";
import {
  filterCandidates,
  sortCandidates,
} from "@/lib/candidates/list-filters";
import { submitCandidateWithResume } from "@/lib/candidates/submit-candidate-upload";
import { parseResumeFile } from "@/lib/resume/parse-resume";
import type {
  CandidateExperienceFilter,
  CandidateListItem,
  CandidateVerdictFilter,
} from "@/types/candidate";
import type { CandidateSource } from "@/types/job";
import { sourceBadgeLabel } from "@/types/job";

function experienceLabel(c: CandidateListItem): string {
  const t = c.signal_profile.total_years_experience?.trim();
  return t && t !== "0" ? `${t} yrs` : "—";
}

type SourceFilter = "all" | CandidateSource;

export function TalentPoolWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [verdict, setVerdict] = useState<CandidateVerdictFilter>("all");
  const [experience, setExperience] = useState<CandidateExperienceFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [panelId, setPanelId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
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
    router.replace(qs ? `/talent-pool?${qs}` : "/talent-pool", { scroll: false });
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

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  const filtered = useMemo(() => {
    const base = filterCandidates(candidates, {
      search,
      verdict,
      companyType: "all",
      experience,
    });
    const withSource =
      sourceFilter === "all"
        ? base
        : base.filter((c) => c.source === sourceFilter);
    return sortCandidates(withSource, "recent");
  }, [candidates, search, verdict, experience, sourceFilter]);

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
          source: "uploaded",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
      }
      setShowUpload(false);
      await loadCandidates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="pb-12">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={karta.pageTitle}>Talent Pool</h1>
          <p className="mt-1 text-[15px] text-[#64748B]">
            All candidates across every job — search, filter, and open profiles.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowUpload((s) => !s)}
          className={`inline-flex items-center gap-2 ${karta.btnPrimary}`}
        >
          <Upload className="h-4 w-4" />
          Upload Resumes
        </button>
      </div>

      {showUpload && (
        <div className={`mb-6 ${karta.card} p-4`}>
          <div className="mb-2 flex justify-between">
            <span className={karta.sectionHeading}>Upload</span>
            <button type="button" onClick={() => setShowUpload(false)}>
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
          <label
            className={`flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-slate-300 py-8 text-sm text-slate-600 ${uploading ? "opacity-60" : ""}`}
          >
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              multiple
              className="sr-only"
              disabled={uploading}
              onChange={(e) => void handleFiles(e.target.files)}
            />
            Drop resumes or click to browse
          </label>
        </div>
      )}

      {error && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name"
            className={`w-full pl-9 ${karta.input}`}
          />
        </div>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
          className={karta.input}
          aria-label="Filter by source"
        >
          <option value="all">All sources</option>
          <option value="uploaded">Uploaded</option>
          <option value="application">Application</option>
          <option value="linkedin_profile">LinkedIn Profile</option>
        </select>
        <select
          value={verdict}
          onChange={(e) => setVerdict(e.target.value as CandidateVerdictFilter)}
          className={karta.input}
          aria-label="Filter by verdict"
        >
          <option value="all">All verdicts</option>
          <option value="strong">Strong fit</option>
          <option value="possible">Possible fit</option>
          <option value="weak">Weak fit</option>
          <option value="not_suitable">Not suitable</option>
          <option value="unscored">Unscored</option>
        </select>
        <select
          value={experience}
          onChange={(e) =>
            setExperience(e.target.value as CandidateExperienceFilter)
          }
          className={karta.input}
          aria-label="Filter by experience"
        >
          <option value="all">All experience</option>
          <option value="0-3">0–3 years</option>
          <option value="4-7">4–7 years</option>
          <option value="8-12">8–12 years</option>
          <option value="13+">13+ years</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <p className={`${karta.card} py-12 text-center text-sm text-[#64748B]`}>
          No candidates match your filters.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {filtered.map((c) => {
            const topSkills = c.signal_profile.skills_verified
              .slice(0, 2)
              .map((s) => s.skill);
            const jobBadges = c.role_scores
              .filter((s) => s.role_brief_title)
              .slice(0, 4);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setPanel(c.id)}
                  className={`w-full text-left ${karta.card} p-5 transition hover:border-slate-300`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[#1E293B]">
                      {c.display_name}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {sourceBadgeLabel(c.source)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#64748B]">
                    {experienceLabel(c)}
                  </p>
                  {jobBadges.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {jobBadges.map((s) => (
                        <span
                          key={s.id}
                          className="rounded-full bg-[#0D9488]/10 px-2 py-0.5 text-xs font-medium text-[#0D9488]"
                        >
                          {s.role_brief_title}
                        </span>
                      ))}
                    </div>
                  )}
                  {topSkills.length > 0 && (
                    <p className="mt-2 text-xs text-[#64748B]">
                      Verified: {topSkills.join(" · ")}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <CandidateSlidePanel
        candidateId={panelId}
        activeRoleBrief={null}
        onClose={() => setPanel(null)}
      />
    </div>
  );
}
