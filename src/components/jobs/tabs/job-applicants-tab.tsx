"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Upload } from "lucide-react";
import { VerdictBadge } from "@/components/candidates/profile-shared";
import { getScoreForRole } from "@/lib/candidates/active-role-score";
import { karta } from "@/lib/brand/karta";
import { parseResumeFile } from "@/lib/resume/parse-resume";
import type { CandidateListItem } from "@/types/candidate";
import { sourceBadgeLabel } from "@/types/job";

function experienceLabel(c: CandidateListItem): string {
  const t = c.signal_profile.total_years_experience?.trim();
  return t && t !== "0" ? t : "—";
}

type JobApplicantsTabProps = {
  jobId: string;
  jobTitle: string;
};

export function JobApplicantsTab({ jobId, jobTitle }: JobApplicantsTabProps) {
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [unlikelyOpen, setUnlikelyOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/candidates`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setCandidates(json.candidates as CandidateListItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const newApplicants = useMemo(
    () =>
      candidates
        .filter((c) => c.scoring_status === "unscored")
        .sort(
          (a, b) =>
            new Date(b.applied_at ?? b.created_at).getTime() -
            new Date(a.applied_at ?? a.created_at).getTime(),
        ),
    [candidates],
  );

  const reviewed = useMemo(
    () =>
      candidates
        .filter((c) => c.scoring_status === "scored")
        .sort((a, b) => {
          const sa = getScoreForRole(a, jobId)?.overall_score ?? 0;
          const sb = getScoreForRole(b, jobId)?.overall_score ?? 0;
          return sb - sa;
        }),
    [candidates, jobId],
  );

  const unlikely = useMemo(
    () => candidates.filter((c) => c.scoring_status === "low_relevance"),
    [candidates],
  );

  const scoreOne = async (candidateId: string) => {
    setScoringId(candidateId);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleBriefId: jobId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Scoring failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scoring failed");
    } finally {
      setScoringId(null);
    }
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const resumeText = await parseResumeFile(file);
        const res = await fetch("/api/candidates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resumeText,
            resumeFilename: file.name,
            jobId,
            source: "uploaded",
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const archiveAll = async () => {
    setArchiving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/archive-unlikely`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Archive failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
    } finally {
      setArchiving(false);
    }
  };

  const renderRow = (
    c: CandidateListItem,
    mode: "new" | "reviewed",
  ) => {
    const score = getScoreForRole(c, jobId);
    const isScoring = scoringId === c.id;

    return (
      <tr key={c.id} className="border-b border-slate-100 last:border-0">
        <td className="px-4 py-3 font-medium text-slate-900">{c.display_name}</td>
        <td className="px-4 py-3 text-slate-600">{experienceLabel(c)}</td>
        <td className="px-4 py-3">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {sourceBadgeLabel(c.source)}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          {mode === "new" ? (
            isScoring ? (
              <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Scoring…
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void scoreOne(c.id)}
                className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-200 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-100" />
                </span>
                Review and Score
              </button>
            )
          ) : score ? (
            <VerdictBadge verdict={score.verdict} score={score.overall_score} compact />
          ) : null}
        </td>
      </tr>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <label
          className={`inline-flex cursor-pointer items-center gap-2 ${karta.btnSecondary}`}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Upload Resumes
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={(e) => void uploadFiles(e.target.files)}
          />
        </label>
        <button
          type="button"
          className={karta.btnSecondary}
          onClick={() =>
            alert(
              "LinkedIn profile import is coming soon. Paste a profile URL in a future release.",
            )
          }
        >
          Import LinkedIn Profile
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <section className={`${karta.card} overflow-hidden`}>
        <h3 className="border-b border-slate-200 px-5 py-4 text-base font-semibold text-slate-900">
          New Applicants
        </h3>
        {newApplicants.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">
            No new applicants for {jobTitle}.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Experience</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>{newApplicants.map((c) => renderRow(c, "new"))}</tbody>
          </table>
        )}
      </section>

      <section className={`${karta.card} overflow-hidden`}>
        <h3 className="border-b border-slate-200 px-5 py-4 text-base font-semibold text-slate-900">
          Reviewed Applicants
        </h3>
        {reviewed.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">No reviewed applicants yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Experience</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3 text-right">Match</th>
              </tr>
            </thead>
            <tbody>{reviewed.map((c) => renderRow(c, "reviewed"))}</tbody>
          </table>
        )}
      </section>

      <section className={`${karta.card} overflow-hidden`}>
        <button
          type="button"
          onClick={() => setUnlikelyOpen((o) => !o)}
          className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50"
        >
          <span className="text-base font-semibold text-slate-900">
            Unlikely Fit ({unlikely.length})
          </span>
          {unlikelyOpen ? (
            <ChevronDown className="h-5 w-5 text-slate-500" />
          ) : (
            <ChevronRight className="h-5 w-5 text-slate-500" />
          )}
        </button>
        {unlikelyOpen && (
          <div className="border-t border-slate-200">
            {unlikely.length > 0 && (
              <div className="flex justify-end border-b border-slate-100 px-5 py-3">
                <button
                  type="button"
                  disabled={archiving}
                  onClick={() => void archiveAll()}
                  className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                >
                  {archiving ? "Archiving…" : "Archive All"}
                </button>
              </div>
            )}
            {unlikely.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-500">None flagged.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <tbody>
                  {unlikely.map((c) => {
                    const score = getScoreForRole(c, jobId);
                    return (
                      <tr key={c.id} className="border-b border-slate-100">
                        <td className="px-4 py-3 font-medium">{c.display_name}</td>
                        <td className="px-4 py-3 text-right">
                          {score && (
                            <VerdictBadge
                              verdict={score.verdict}
                              score={score.overall_score}
                              compact
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
