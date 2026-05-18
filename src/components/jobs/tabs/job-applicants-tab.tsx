"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Upload } from "lucide-react";
import { ClickableCandidateName } from "@/components/candidates/clickable-candidate-name";
import { VerdictBadge } from "@/components/candidates/profile-shared";
import { useCandidatePanel } from "@/contexts/candidate-panel-context";
import { getScoreForRole } from "@/lib/candidates/active-role-score";
import { formatTotalExperienceDisplay } from "@/lib/candidates/format-total-experience";
import { formatTitleAtCompanySubtitle } from "@/lib/candidates/profile-display";
import { karta } from "@/lib/brand/karta";
import { submitCandidateWithResume } from "@/lib/candidates/submit-candidate-upload";
import { parseResumeFile } from "@/lib/resume/parse-resume";
import {
  ResumeUploadProgress,
  type ResumeUploadFileItem,
} from "@/components/jobs/resume-upload-progress";
import type { CandidateListItem } from "@/types/candidate";
import type { Job } from "@/types/job";
import { sourceBadgeLabel } from "@/types/job";

type JobApplicantsTabProps = {
  jobId: string;
  jobTitle: string;
  roleBrief: Job;
};

type UploadUiState =
  | { phase: "idle" }
  | { phase: "processing"; files: ResumeUploadFileItem[] }
  | { phase: "success"; files: ResumeUploadFileItem[]; count: number };

export function JobApplicantsTab({
  jobId,
  jobTitle,
  roleBrief,
}: JobApplicantsTabProps) {
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [uploadUi, setUploadUi] = useState<UploadUiState>({ phase: "idle" });
  const [unlikelyOpen, setUnlikelyOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const newApplicantsRef = useRef<HTMLElement>(null);
  const { openPanel, refreshPanel, candidateId: openPanelId } = useCandidatePanel();

  const panelOptions = useMemo(
    () => ({ contextJobId: jobId, roleBrief }),
    [jobId, roleBrief],
  );

  const uploading = uploadUi.phase === "processing";

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
      if (openPanelId === candidateId) refreshPanel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scoring failed");
    } finally {
      setScoringId(null);
    }
  };

  const uploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const fileList = Array.from(files);
    setError(null);

    const initial: ResumeUploadFileItem[] = fileList.map((f) => ({
      name: f.name,
      status: "pending",
    }));
    setUploadUi({ phase: "processing", files: initial });

    let successCount = 0;
    const nextFiles = [...initial];

    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        nextFiles[i] = { ...nextFiles[i], status: "processing" };
        setUploadUi({ phase: "processing", files: [...nextFiles] });

        try {
          const resumeText = await parseResumeFile(file);
          const res = await submitCandidateWithResume({
            resumeText,
            resumeFilename: file.name,
            resumeFile: file,
            jobId,
            source: "uploaded",
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Upload failed");
          nextFiles[i] = { name: file.name, status: "done" };
          successCount += 1;
        } catch (err) {
          nextFiles[i] = {
            name: file.name,
            status: "error",
            error: err instanceof Error ? err.message : "Upload failed",
          };
        }
        setUploadUi({ phase: "processing", files: [...nextFiles] });
      }

      await load();

      if (successCount === 0) {
        setError("No resumes could be processed. Check the files and try again.");
        setUploadUi({ phase: "idle" });
        return;
      }

      setUploadUi({
        phase: "success",
        files: nextFiles,
        count: successCount,
      });

      requestAnimationFrame(() => {
        newApplicantsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });

      window.setTimeout(() => {
        setUploadUi({ phase: "idle" });
      }, 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploadUi({ phase: "idle" });
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
    const rowClickable = mode === "reviewed";
    const roleSubtitle = formatTitleAtCompanySubtitle(
      c.current_title,
      c.current_company,
    );

    return (
      <tr
        key={c.id}
        className={`border-b border-slate-100 last:border-0 ${
          rowClickable ? "cursor-pointer hover:bg-slate-50" : ""
        }`}
        onClick={
          rowClickable
            ? (e) => {
                if ((e.target as HTMLElement).closest("button, a, input")) {
                  return;
                }
                openPanel(c.id, panelOptions);
              }
            : undefined
        }
      >
        <td className="px-4 py-3">
          <div>
            {mode === "new" ? (
              <ClickableCandidateName
                candidateId={c.id}
                panelOptions={panelOptions}
              >
                {c.display_name}
              </ClickableCandidateName>
            ) : (
              <span className="font-medium text-slate-900">{c.display_name}</span>
            )}
            {roleSubtitle ? (
              <p className="mt-0.5 text-xs text-slate-500">{roleSubtitle}</p>
            ) : null}
          </div>
        </td>
        <td className="px-4 py-3 text-slate-600">
          {formatTotalExperienceDisplay(c.signal_profile.total_years_experience)}
        </td>
        <td className="px-4 py-3">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {sourceBadgeLabel(c.source)}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          {mode === "new" ? (
            isScoring ? (
              <span className="inline-flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin text-[#0D9488]" />
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

  return (
    <div className="space-y-8">
      <div className="w-full space-y-4">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <label
            className={`inline-flex cursor-pointer items-center gap-2 ${karta.btnSecondary} ${
              uploading ? "pointer-events-none opacity-70" : ""
            }`}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#0D9488]" />
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
              onChange={(e) => {
                void uploadFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            className={karta.btnSecondary}
            disabled={uploading}
            onClick={() =>
              alert(
                "LinkedIn profile import is coming soon. Paste a profile URL in a future release.",
              )
            }
          >
            Import LinkedIn Profile
          </button>
        </div>

        {uploadUi.phase !== "idle" && (
          <ResumeUploadProgress
            files={uploadUi.files}
            phase={uploadUi.phase}
            successCount={
              uploadUi.phase === "success" ? uploadUi.count : undefined
            }
          />
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <section
        ref={newApplicantsRef}
        id="new-applicants"
        className={`${karta.card} overflow-hidden`}
      >
        <h3 className="border-b border-slate-200 px-5 py-4 text-base font-semibold text-slate-900">
          New Applicants
        </h3>
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-[#64748B]">
            <Loader2 className="h-5 w-5 animate-spin text-[#0D9488]" />
            Loading applicants…
          </div>
        ) : newApplicants.length === 0 ? (
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
        {loading ? (
          <div className="flex justify-center px-5 py-12">
            <Loader2 className="h-5 w-5 animate-spin text-[#0D9488]" />
          </div>
        ) : reviewed.length === 0 ? (
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
