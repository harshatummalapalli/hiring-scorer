"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, Upload, X } from "lucide-react";
import { NotAFitModal } from "@/components/candidates/not-a-fit-modal";
import { ClickableCandidateName } from "@/components/candidates/clickable-candidate-name";
import { CoreStrengthLabel } from "@/components/candidates/core-strength-label";
import { DuplicateWarningModal } from "@/components/candidates/duplicate-warning-modal";
import { CandidateListMeta } from "@/components/candidates/candidate-list-meta";
import { useCandidatePanel } from "@/contexts/candidate-panel-context";
import { formatTotalExperienceDisplay } from "@/lib/candidates/format-total-experience";
import type { DuplicateMatch } from "@/lib/candidates/duplicate-messages";
import { karta } from "@/lib/brand/karta";
import { submitCandidateWithResume } from "@/lib/candidates/submit-candidate-upload";
import { parseResumeFile } from "@/lib/resume/parse-resume";
import {
  ResumeUploadProgress,
  type ResumeUploadFileItem,
} from "@/components/jobs/resume-upload-progress";
import { EmptyState } from "@/components/ui/empty-state";
import type { CandidateListItem } from "@/types/candidate";
import type { Job } from "@/types/job";
import { isUnlikelyFitStatus, sourceBadgeLabel } from "@/types/job";

type TalentMatch = {
  candidateId: string;
  candidateName: string;
  yearsExperience: string;
  matchPercent: number;
  previousRoleTitle: string;
  seniorityNote?: string | null;
};

type JobApplicantsTabProps = {
  jobId: string;
  jobTitle: string;
  roleBrief: Job;
  onGoToAssessed?: () => void;
};

type UploadUiState =
  | { phase: "idle" }
  | { phase: "processing"; files: ResumeUploadFileItem[] }
  | { phase: "success"; files: ResumeUploadFileItem[]; count: number };

type PendingUpload = {
  resumeText: string;
  resumeFilename: string;
  resumeFile: File;
};

export function JobApplicantsTab({
  jobId,
  jobTitle,
  roleBrief,
}: JobApplicantsTabProps) {
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [matches, setMatches] = useState<TalentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [batchScoring, setBatchScoring] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploadUi, setUploadUi] = useState<UploadUiState>({ phase: "idle" });
  const [unlikelyOpen, setUnlikelyOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [rematchingId, setRematchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicateMatch, setDuplicateMatch] = useState<DuplicateMatch | null>(null);
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null);
  const [rejectTarget, setRejectTarget] = useState<CandidateListItem | null>(null);
  const [rejecting, setRejecting] = useState(false);
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
      await fetch(`/api/jobs/${jobId}/reclassify-applicants`, { method: "POST" });
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

  const loadMatches = useCallback(async () => {
    setMatchesLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/talent-matches`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load matches");
      setMatches(json.matches as TalentMatch[]);
    } catch {
      setMatches([]);
    } finally {
      setMatchesLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
    void loadMatches();
  }, [load, loadMatches]);

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

  const unlikely = useMemo(
    () => candidates.filter((c) => isUnlikelyFitStatus(c.scoring_status)),
    [candidates],
  );

  const allNewSelected =
    newApplicants.length > 0 && selected.size === newApplicants.length;

  const toggleAll = () => {
    if (allNewSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(newApplicants.map((c) => c.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirmReject = async (reason: string, detail: string | null) => {
    if (!rejectTarget) return;
    setRejecting(true);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${rejectTarget.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleBriefId: jobId,
          reason,
          reasonDetail: detail,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to mark not a fit");
      setRejectTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark not a fit");
    } finally {
      setRejecting(false);
    }
  };

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

  const scoreSelected = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBatchScoring(true);
    setError(null);
    try {
      for (const id of ids) {
        const res = await fetch(`/api/candidates/${id}/score`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roleBriefId: jobId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Scoring failed");
      }
      setSelected(new Set());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch scoring failed");
    } finally {
      setBatchScoring(false);
    }
  };

  const rematch = async (candidateId: string) => {
    setRematchingId(candidateId);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${candidateId}/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleBriefId: jobId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Re-match failed");
      await load();
      await loadMatches();
      if (openPanelId === candidateId) refreshPanel();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Re-match failed");
    } finally {
      setRematchingId(null);
    }
  };

  const uploadOne = async (pending: PendingUpload, force = false) => {
    const res = await submitCandidateWithResume({
      ...pending,
      jobId,
      source: "uploaded",
      forceUpload: force,
    });
    const json = await res.json();
    if (res.status === 409 && json.duplicate) {
      setDuplicateMatch(json.duplicate as DuplicateMatch);
      setPendingUpload(pending);
      throw new Error("duplicate");
    }
    if (!res.ok) throw new Error(json.error ?? "Upload failed");
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
          await uploadOne({
            resumeText,
            resumeFilename: file.name,
            resumeFile: file,
          });
          nextFiles[i] = { name: file.name, status: "done" };
          successCount += 1;
        } catch (err) {
          if (err instanceof Error && err.message === "duplicate") {
            nextFiles[i] = {
              name: file.name,
              status: "error",
              error: "Duplicate — resolve prompt",
            };
            break;
          }
          nextFiles[i] = {
            name: file.name,
            status: "error",
            error: err instanceof Error ? err.message : "Upload failed",
          };
        }
        setUploadUi({ phase: "processing", files: [...nextFiles] });
      }

      if (successCount > 0) {
        await load();
        await loadMatches();
      }

      if (successCount === 0 && !duplicateMatch) {
        setError("No resumes could be processed. Check the files and try again.");
        setUploadUi({ phase: "idle" });
        return;
      }

      if (successCount > 0) {
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
        window.setTimeout(() => setUploadUi({ phase: "idle" }), 5000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploadUi({ phase: "idle" });
    }
  };

  const handleDuplicateProceed = async () => {
    if (!pendingUpload) return;
    const pending = pendingUpload;
    setDuplicateMatch(null);
    setPendingUpload(null);
    try {
      await uploadOne(pending, true);
      await load();
      await loadMatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <label
          className={`inline-flex cursor-pointer items-center gap-2 ${karta.btnPrimary} ${
            uploading ? "pointer-events-none opacity-70" : ""
          }`}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Add Applicants
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
        <div
          className={`flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] px-5 py-4 ${karta.accentAmberHeader}`}
        >
          <h3 className={karta.cardTitle}>New Applicants</h3>
          {selected.size > 0 && (
            <button
              type="button"
              disabled={batchScoring}
              onClick={() => void scoreSelected()}
              className={karta.btnPrimary}
            >
              {batchScoring ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Score Selected (${selected.size})`
              )}
            </button>
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-[#64748B]">
            <Loader2 className="h-5 w-5 animate-spin text-[#0D9488]" />
            Loading applicants…
          </div>
        ) : newApplicants.length === 0 ? (
          <div className="px-4 py-6">
            <EmptyState
              illustration="people"
              heading="Ready when you are"
              subtitle="Upload resumes to start building your applicant pipeline."
              className="border-0 shadow-none"
            />
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={karta.tableHeadRow}>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allNewSelected}
                    onChange={toggleAll}
                    aria-label="Select all new applicants"
                  />
                </th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Experience</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {newApplicants.map((c) => {
                const isScoring = scoringId === c.id;
                const isSelected = selected.has(c.id);
                return (
                  <tr
                    key={c.id}
                    className={`border-b border-[#E2E8F0] last:border-0 transition-[border-color] duration-150 ${
                      isScoring
                        ? "scoring-row-active"
                        : isSelected
                          ? "applicant-row-selected"
                          : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(c.id)}
                        aria-label={`Select ${c.display_name}`}
                        className={isSelected ? "checkbox-checked" : ""}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <ClickableCandidateName
                        candidateId={c.id}
                        panelOptions={panelOptions}
                      >
                        {c.display_name}
                      </ClickableCandidateName>
                      <CandidateListMeta
                        currentTitle={c.current_title}
                        currentCompany={c.current_company}
                        yearsExperience={
                          c.signal_profile.total_years_experience
                        }
                      />
                      <CoreStrengthLabel
                        primary={c.signal_profile.core_strength_primary}
                        secondary={c.signal_profile.core_strength_secondary}
                      />
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatTotalExperienceDisplay(
                        c.signal_profile.total_years_experience,
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {sourceBadgeLabel(c.source)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isScoring ? (
                        <span className="inline-flex items-center gap-2 text-sm font-medium text-[#64748B]">
                          <Loader2 className="h-4 w-4 animate-spin text-[#0D9488]" />
                          Analysing…
                        </span>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={rejecting}
                            onClick={() => setRejectTarget(c)}
                            className={`inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50`}
                          >
                            <X className="h-3.5 w-3.5" aria-hidden />
                            Not a Fit
                          </button>
                          <button
                            type="button"
                            onClick={() => void scoreOne(c.id)}
                            className={`btn-press inline-flex items-center gap-2 rounded-full bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-amber-600`}
                          >
                            <span
                              className="review-dot-pulse inline-block h-2 w-2 rounded-full bg-amber-200"
                              aria-hidden
                            />
                            Review and Score
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className={`${karta.card} overflow-hidden`}>
        <h3 className="border-b border-slate-200 px-5 py-4 text-base font-semibold text-slate-900">
          Recommended from Your Talent Pool
        </h3>
        {matchesLoading ? (
          <div className="flex justify-center px-5 py-12">
            <Loader2 className="h-5 w-5 animate-spin text-[#0D9488]" />
          </div>
        ) : matches.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">
            No talent pool matches for this role yet.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {matches.map((m) => (
              <li
                key={m.candidateId}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
              >
                <div>
                  <ClickableCandidateName
                    candidateId={m.candidateId}
                    panelOptions={panelOptions}
                    className="font-semibold text-[#1E293B] hover:text-[#0D9488] hover:underline"
                  >
                    {m.candidateName}
                  </ClickableCandidateName>
                  <p className="mt-1 text-sm text-[#64748B]">
                    {formatTotalExperienceDisplay(m.yearsExperience)} · Previously
                    scored: {m.previousRoleTitle}
                  </p>
                  {m.seniorityNote && (
                    <p
                      className={`mt-1 text-xs ${
                        m.seniorityNote.includes("below")
                          ? "text-amber-700"
                          : "text-[#94A3B8]"
                      }`}
                    >
                      {m.seniorityNote}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-lg font-semibold text-[#0D9488]">
                    {m.matchPercent}%
                  </span>
                  <button
                    type="button"
                    disabled={rematchingId === m.candidateId}
                    onClick={() => void rematch(m.candidateId)}
                    className={karta.btnSecondary}
                  >
                    {rematchingId === m.candidateId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Re-match"
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
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
                  {unlikely.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100">
                      <td className="px-4 py-3">
                        <p className="font-medium">{c.display_name}</p>
                        {c.scoring_status === "manually_rejected" && (
                          <span className="mt-1 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                            Manually marked as not a fit
                          </span>
                        )}
                        {c.manual_rejection_reason && (
                          <p className="mt-1 text-xs text-[#64748B]">
                            {c.manual_rejection_reason}
                            {c.manual_rejection_detail
                              ? ` — ${c.manual_rejection_detail}`
                              : ""}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>

      {rejectTarget && (
        <NotAFitModal
          candidateName={rejectTarget.display_name}
          onClose={() => setRejectTarget(null)}
          onConfirm={(reason, detail) => void confirmReject(reason, detail)}
        />
      )}

      {duplicateMatch && (
        <DuplicateWarningModal
          match={duplicateMatch}
          onViewExisting={() => {
            openPanel(duplicateMatch.candidateId, panelOptions);
            setDuplicateMatch(null);
            setPendingUpload(null);
          }}
          onProceed={() => void handleDuplicateProceed()}
        />
      )}
    </div>
  );
}
