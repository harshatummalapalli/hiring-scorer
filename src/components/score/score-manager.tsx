"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";
import { useActiveRoleBrief } from "@/contexts/active-role-brief-context";
import { useScoringDebug } from "@/contexts/scoring-debug-context";
import { getErrorMessage } from "@/lib/errors";
import {
  SCORE_ALL_READY_LABEL,
  SCORE_CANDIDATE_BUTTON,
  SCORING_IN_PROGRESS_LABEL,
  SCORING_PANEL_DESCRIPTION,
  SCORING_PANEL_TITLE,
} from "@/lib/scoring/recruiter-labels";
import { buildSavedScoreInsertPayload } from "@/lib/saved-scores/build-save-payload";
import { createSupabaseClient } from "@/lib/supabase/client";
import { parseResumeFile } from "@/lib/resume/parse-resume";
import { stripPII } from "@/lib/resume/strip-pii";
import { PiiPreview } from "./pii-preview";
import type { RoleBrief } from "@/types/role-brief";
import type { CandidateScoreResult } from "@/types/score";
import type { UploadedCandidate } from "@/types/uploaded-candidate";
import { createCandidateId } from "@/types/uploaded-candidate";
import { CandidateScoreCard } from "./candidate-score-card";
import { ResumeUpload } from "./resume-upload";

async function scoreResume(
  resumeText: string,
  roleBrief: RoleBrief,
  candidateFilename: string,
): Promise<CandidateScoreResult> {
  const res = await fetch("/api/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeText, roleBrief, candidateFilename }),
  });
  const data = (await res.json()) as {
    error?: string;
    result?: CandidateScoreResult;
  };
  if (!res.ok) {
    throw new Error(data.error ?? "Scoring failed");
  }
  return data.result as CandidateScoreResult;
}

export function ScoreManager() {
  const { activeBriefId, hydrated, setActiveBrief } = useActiveRoleBrief();
  const { appendRun } = useScoringDebug();

  const [allBriefs, setAllBriefs] = useState<RoleBrief[]>([]);
  const [roleBrief, setRoleBrief] = useState<RoleBrief | null>(null);
  const [loadingBrief, setLoadingBrief] = useState(true);

  const [candidates, setCandidates] = useState<UploadedCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [scoring, setScoring] = useState(false);
  const [scoringAll, setScoringAll] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => candidates.find((c) => c.id === selectedId) ?? null,
    [candidates, selectedId],
  );

  const parsingCount = candidates.filter((c) => c.status === "parsing").length;
  const readyCount = candidates.filter(
    (c) => c.status === "ready" || c.status === "error",
  ).length;

  const loadBriefs = useCallback(async () => {
    if (!hydrated) return;

    setLoadingBrief(true);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("role_briefs")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      const briefs = (data ?? []) as RoleBrief[];
      setAllBriefs(briefs);

      if (briefs.length === 0) {
        setRoleBrief(null);
        return;
      }

      const matched = activeBriefId
        ? briefs.find((b) => b.id === activeBriefId)
        : undefined;
      const pick = matched ?? briefs[0];

      setActiveBrief(pick);
      setRoleBrief(pick);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load role briefs"));
      setRoleBrief(null);
      setAllBriefs([]);
    } finally {
      setLoadingBrief(false);
    }
  }, [activeBriefId, hydrated, setActiveBrief]);

  useEffect(() => {
    loadBriefs();
  }, [loadBriefs]);

  const updateCandidate = useCallback(
    (id: string, patch: Partial<UploadedCandidate>) => {
      setCandidates((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      );
    },
    [],
  );

  const handleBriefChange = (id: string) => {
    const brief = allBriefs.find((b) => b.id === id);
    if (brief) {
      setActiveBrief(brief);
      setRoleBrief(brief);
    }
  };

  const handleFilesAdd = async (files: File[]) => {
    setError(null);

    const newEntries: UploadedCandidate[] = files.map((file) => ({
      id: createCandidateId(),
      file,
      resumeTextRaw: "",
      resumeText: "",
      status: "parsing" as const,
    }));

    setCandidates((prev) => [...prev, ...newEntries]);
    if (!selectedId && newEntries[0]) {
      setSelectedId(newEntries[0].id);
    }

    await Promise.all(
      newEntries.map(async (entry) => {
        try {
          const raw = await parseResumeFile(entry.file);
          const { original, stripped } = stripPII(raw);
          updateCandidate(entry.id, {
            resumeTextRaw: original,
            resumeText: stripped,
            status: "ready",
          });
        } catch (err) {
          updateCandidate(entry.id, {
            status: "error",
            error:
              err instanceof Error ? err.message : "Failed to parse resume",
          });
        }
      }),
    );
  };

  const handleRemove = (id: string) => {
    setCandidates((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (selectedId === id) {
        setSelectedId(next[0]?.id ?? null);
      }
      return next;
    });
    setSavedMessage(null);
  };

  const handleClearAll = () => {
    setCandidates([]);
    setSelectedId(null);
    setSavedMessage(null);
    setError(null);
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setSavedMessage(null);
    setError(null);
  };

  const runScore = async (candidate: UploadedCandidate) => {
    if (!roleBrief || !candidate.resumeText) return;

    updateCandidate(candidate.id, { status: "scoring", error: undefined });

    const startedAt = Date.now();

    try {
      const result = await scoreResume(
        candidate.resumeText,
        roleBrief,
        candidate.file.name,
      );
      const durationMs = Date.now() - startedAt;
      console.log("[Hiring Scorer] Scoring complete", result);
      console.log(
        "[Hiring Scorer] Model raw JSON responses",
        result.model_raw_responses,
      );
      appendRun({
        candidateFilename: candidate.file.name,
        roleBrief,
        result,
        durationMs,
      });
      updateCandidate(candidate.id, {
        status: "scored",
        result,
        savedId: undefined,
      });
    } catch (err) {
      const message = getErrorMessage(err, "Failed to score candidate");
      appendRun({
        candidateFilename: candidate.file.name,
        roleBrief,
        error: message,
        durationMs: Date.now() - startedAt,
      });
      updateCandidate(candidate.id, { status: "error", error: message });
      throw err;
    }
  };

  const handleScoreSelected = async () => {
    if (!selected || selected.status !== "ready") return;

    setScoring(true);
    setError(null);

    try {
      await runScore(selected);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to score candidate"));
    } finally {
      setScoring(false);
    }
  };

  const handleScoreAll = async () => {
    if (!roleBrief) return;

    const toScore = candidates.filter((c) => c.status === "ready");
    if (toScore.length === 0) return;

    setScoringAll(true);
    setError(null);

    for (const candidate of toScore) {
      setSelectedId(candidate.id);
      try {
        await runScore(candidate);
      } catch (err) {
        setError(getErrorMessage(err, "Failed to score candidate"));
        break;
      }
    }

    setScoringAll(false);
  };

  const handleSaveWithTag = async (tag: string) => {
    if (!roleBrief) {
      setError("No active role brief selected. Go to Role Briefs and set one as active.");
      return;
    }
    if (!selected?.result) {
      setError("No score result to save. Score the candidate first.");
      return;
    }
    if (selected.savedId) return;

    setSaving(true);
    setError(null);
    setSavedMessage(null);

    try {
      const payload = buildSavedScoreInsertPayload(
        selected.file.name,
        roleBrief,
        selected.result,
        tag,
        "",
      );
      const res = await fetch("/api/save-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save score");
      updateCandidate(selected.id, { savedId: json.id as string });
      setSavedMessage(`Saved with tag “${tag}”.`);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save score"));
    } finally {
      setSaving(false);
    }
  };

  const busy = parsingCount > 0 || scoring || scoringAll || saving;

  if (!hydrated || loadingBrief) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        <span className="text-sm">Loading role briefs…</span>
      </div>
    );
  }

  if (allBriefs.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-8 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-600" />
        <p className="font-medium text-amber-900">No role briefs yet</p>
        <p className="mt-1 text-sm text-amber-800">
          Create a role brief first, then return here to evaluate candidates.
        </p>
        <Link
          href="/role-briefs"
          className="mt-4 inline-block rounded-lg bg-amber-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800"
        >
          Go to Role Briefs
        </Link>
      </div>
    );
  }

  if (!roleBrief) return null;

  const canScoreSelected = selected?.status === "ready";
  const canScoreAll = readyCount > 0 && !scoring && !scoringAll;

  return (
    <div className="space-y-8">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label
          htmlFor="role-brief-select"
          className="mb-1.5 block text-sm font-medium text-slate-700"
        >
          Role brief for scoring
        </label>
        {allBriefs.length > 1 ? (
          <select
            id="role-brief-select"
            value={roleBrief.id}
            onChange={(e) => handleBriefChange(e.target.value)}
            disabled={busy}
            className="w-full max-w-lg rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:opacity-60"
          >
            {allBriefs.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
                {b.title_band ? ` · ${b.title_band}` : ""}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-slate-900">
            <span className="font-semibold">{roleBrief.title}</span>
            {roleBrief.title_band && (
              <span className="text-slate-500"> · {roleBrief.title_band}</span>
            )}
          </p>
        )}
      </div>

      <ResumeUpload
        candidates={candidates}
        selectedId={selectedId}
        onFilesAdd={handleFilesAdd}
        onSelect={handleSelect}
        onRemove={handleRemove}
        onClearAll={handleClearAll}
        disabled={busy}
      />

      {selected?.resumeTextRaw && selected.status !== "parsing" && (
        <PiiPreview
          fileName={selected.file.name}
          original={selected.resumeTextRaw}
          stripped={selected.resumeText}
        />
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          {SCORING_PANEL_TITLE}
        </h2>
        <p className="mt-1 mb-4 text-sm text-slate-500">
          {SCORING_PANEL_DESCRIPTION}
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleScoreSelected}
            disabled={!canScoreSelected || busy}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {scoring ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {scoring ? SCORING_IN_PROGRESS_LABEL : SCORE_CANDIDATE_BUTTON}
          </button>
          {readyCount > 0 && (
            <button
              type="button"
              onClick={handleScoreAll}
              disabled={!canScoreAll || busy}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {scoringAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {scoringAll
                ? SCORING_IN_PROGRESS_LABEL
                : SCORE_ALL_READY_LABEL(readyCount)}
            </button>
          )}
        </div>
      </div>

      {selected?.result && (
        <CandidateScoreCard
          result={selected.result}
          roleBrief={roleBrief}
          candidateFilename={selected.file.name}
          onScreen={() => handleSaveWithTag("Yes")}
          onPass={() => handleSaveWithTag("No")}
          onSaveToPipeline={() => handleSaveWithTag("Hold")}
          actionBusy={saving}
          savedLabel={
            selected.savedId
              ? savedMessage ?? "Evaluation saved to pipeline."
              : savedMessage
          }
        />
      )}
    </div>
  );
}

