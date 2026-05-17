"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { AnalysisCards } from "@/components/role-briefs/analysis-cards";
import { karta } from "@/lib/brand/karta";
import { getErrorMessage } from "@/lib/errors";
import type { JdSessionCache } from "@/lib/role-brief/resolve-jd-analysis";
import type {
  RoleBrief,
  RoleBriefAnalysis,
  RoleBriefAnalysisMeta,
  RoleBriefScoringPrompt,
} from "@/types/role-brief";
import {
  analysisFromRoleBrief,
  deriveTitleFromAnalysis,
  emptyAnalysis,
} from "@/types/role-brief";

type RoleBriefCreatorProps = {
  initialJobDescription?: string;
  initialAnalysis?: RoleBriefAnalysis | null;
  initialTitle?: string;
  initialScoringPrompt?: Partial<RoleBriefScoringPrompt> | null;
  initialAnalysisMeta?: RoleBriefAnalysisMeta | null;
  initialAnalysedJobDescription?: string;
  editingId?: string | null;
  onSave: (data: {
    title: string;
    jobDescription: string;
    analysis: RoleBriefAnalysis;
    scoringPrompt: RoleBriefScoringPrompt;
    analysisMeta: RoleBriefAnalysisMeta;
  }) => Promise<void>;
  isSaving: boolean;
};

const emptyScoringPrompt = (): RoleBriefScoringPrompt => ({
  scoring_prompt: null,
  scoring_prompt_generated_at: null,
  scoring_prompt_version: 1,
});

export function RoleBriefCreator({
  initialJobDescription = "",
  initialAnalysis = null,
  initialTitle = "",
  initialScoringPrompt = null,
  initialAnalysisMeta = null,
  initialAnalysedJobDescription = "",
  editingId = null,
  onSave,
  isSaving,
}: RoleBriefCreatorProps) {
  const [jobDescription, setJobDescription] = useState(initialJobDescription);
  const [analysis, setAnalysis] = useState<RoleBriefAnalysis | null>(
    initialAnalysis,
  );
  const [title, setTitle] = useState(initialTitle);
  const [scoringPrompt, setScoringPrompt] = useState<RoleBriefScoringPrompt>(
    () => ({
      ...emptyScoringPrompt(),
      ...initialScoringPrompt,
      scoring_prompt_version:
        initialScoringPrompt?.scoring_prompt_version ?? 1,
    }),
  );
  const [analysing, setAnalysing] = useState(false);
  const [regeneratingPrompt, setRegeneratingPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [analysisMeta, setAnalysisMeta] = useState<RoleBriefAnalysisMeta>(() => ({
    job_description_hash: initialAnalysisMeta?.job_description_hash ?? null,
    analysis_version: initialAnalysisMeta?.analysis_version ?? 1,
    last_analysed_at: initialAnalysisMeta?.last_analysed_at ?? null,
  }));
  const [analysedJobDescription, setAnalysedJobDescription] = useState(
    initialAnalysedJobDescription || initialJobDescription,
  );

  const scoringPromptReady = Boolean(scoringPrompt.scoring_prompt?.trim());

  const handleAnalyse = async () => {
    if (!jobDescription.trim()) {
      setError("Paste a job description first.");
      return;
    }

    setAnalysing(true);
    setError(null);
    setInfoMessage(null);

    try {
      const sessionCache: JdSessionCache | null =
        analysis && analysedJobDescription.trim()
          ? {
              job_description: analysedJobDescription.trim(),
              analysis,
              deal_breakers: analysis.deal_breakers,
              core_signals: analysis.core_signals,
              preferred_signals: analysis.preferred_signals,
              semantic_clusters: analysis.semantic_clusters,
              scoring_prompt: scoringPrompt.scoring_prompt,
              scoring_prompt_generated_at:
                scoringPrompt.scoring_prompt_generated_at,
              scoring_prompt_version: scoringPrompt.scoring_prompt_version,
              analysis_version: analysisMeta.analysis_version ?? 1,
              last_analysed_at: analysisMeta.last_analysed_at ?? null,
              job_description_hash: analysisMeta.job_description_hash ?? null,
            }
          : null;

      const res = await fetch("/api/analyse-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription: jobDescription.trim(),
          roleBriefId: editingId ?? undefined,
          sessionCache,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        analysis?: RoleBriefAnalysis;
        title?: string;
        scoring_prompt?: string;
        scoring_prompt_generated_at?: string;
        scoring_prompt_version?: number;
        fromCache?: boolean;
        job_description_hash?: string;
        analysis_version?: number;
        last_analysed_at?: string | null;
      };
      if (!res.ok) throw new Error(data.error ?? "Read JD failed");

      const next = data.analysis ?? emptyAnalysis();
      setAnalysis(next);
      setTitle(data.title ?? deriveTitleFromAnalysis(next, jobDescription));
      setScoringPrompt({
        scoring_prompt: data.scoring_prompt?.trim() || null,
        scoring_prompt_generated_at: data.scoring_prompt_generated_at ?? null,
        scoring_prompt_version: data.scoring_prompt_version ?? 1,
      });
      setAnalysisMeta({
        job_description_hash: data.job_description_hash ?? null,
        analysis_version: data.analysis_version ?? 1,
        last_analysed_at: data.last_analysed_at ?? null,
      });
      setAnalysedJobDescription(jobDescription.trim());

      if (data.fromCache) {
        setInfoMessage(
          "Analysis unchanged — using existing JD breakdown.",
        );
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to read job description"));
    } finally {
      setAnalysing(false);
    }
  };

  const handleRegeneratePrompt = async () => {
    if (!analysis) {
      setError("Read the job description before regenerating the prompt.");
      return;
    }
    if (!jobDescription.trim()) {
      setError("Job description is required to regenerate the scoring prompt.");
      return;
    }

    setRegeneratingPrompt(true);
    setError(null);

    try {
      if (editingId) {
        const res = await fetch(
          `/api/role-briefs/${editingId}/regenerate-scoring-prompt`,
          { method: "POST" },
        );
        const data = (await res.json()) as {
          error?: string;
          hint?: string;
          scoring_prompt?: string;
          scoring_prompt_generated_at?: string;
          scoring_prompt_version?: number;
        };
        if (!res.ok) {
          throw new Error(
            data.hint ? `${data.error ?? "Failed"} — ${data.hint}` : data.error,
          );
        }
        setScoringPrompt({
          scoring_prompt: data.scoring_prompt?.trim() || null,
          scoring_prompt_generated_at:
            data.scoring_prompt_generated_at ?? null,
          scoring_prompt_version: data.scoring_prompt_version ?? 1,
        });
      } else {
        const res = await fetch("/api/generate-scoring-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobDescription: jobDescription.trim(),
            analysis,
            scoring_prompt_version: scoringPrompt.scoring_prompt_version,
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          scoring_prompt?: string;
          scoring_prompt_generated_at?: string;
          scoring_prompt_version?: number;
        };
        if (!res.ok) throw new Error(data.error ?? "Failed to regenerate prompt");
        setScoringPrompt({
          scoring_prompt: data.scoring_prompt?.trim() || null,
          scoring_prompt_generated_at:
            data.scoring_prompt_generated_at ?? null,
          scoring_prompt_version: data.scoring_prompt_version ?? 1,
        });
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to regenerate scoring prompt"));
    } finally {
      setRegeneratingPrompt(false);
    }
  };

  const handleSave = async () => {
    if (!analysis) {
      setError("Read the job description before saving.");
      return;
    }
    const finalTitle = title.trim() || deriveTitleFromAnalysis(analysis, jobDescription);
    if (!finalTitle) {
      setError("Role title is required.");
      return;
    }
    setError(null);
    await onSave({
      title: finalTitle,
      jobDescription: jobDescription.trim(),
      analysis,
      scoringPrompt,
      analysisMeta: {
        ...analysisMeta,
        job_description_hash:
          analysisMeta.job_description_hash ??
          null,
      },
    });
  };

  return (
    <div className="space-y-10">
      <section className={`${karta.card} p-8 sm:p-10`}>
        <textarea
          id="job-description"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          rows={14}
          placeholder="Paste the complete job description here — include the title, responsibilities, requirements, and any context about the team or company."
          className={`w-full resize-y ${karta.input} leading-relaxed`}
          aria-label="Job description"
        />

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => void handleAnalyse()}
            disabled={analysing || !jobDescription.trim()}
            className={`inline-flex items-center gap-2 ${karta.btnPrimary} px-8 py-3 text-base`}
          >
            {analysing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
            {analysing ? "Reading…" : "Read JD"}
          </button>
          {analysis && (
            <p className="text-sm text-slate-500">
              Review and edit the extracted signals below, then save.
            </p>
          )}
        </div>

        {infoMessage && (
          <p
            className="mt-4 rounded-md border border-[#0D9488]/30 bg-teal-50 px-3 py-2 text-sm text-[#0F766E]"
            role="status"
          >
            {infoMessage}
          </p>
        )}
        {error && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </section>

      {analysis && (
        <>
          <AnalysisCards
            analysis={analysis}
            onChange={setAnalysis}
            extractedTitle={title}
            onTitleChange={setTitle}
            scoringPromptReady={scoringPromptReady}
            scoringPromptVersion={scoringPrompt.scoring_prompt_version}
            onRegeneratePrompt={handleRegeneratePrompt}
            regeneratingPrompt={regeneratingPrompt}
          />

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-8">
            <p className="text-sm text-[#64748B]">
              {editingId ? "Update this job role." : "Save as a new job role."}
            </p>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className={`inline-flex items-center gap-2 ${karta.btnPrimary} px-8 py-3 text-base`}
            >
              {isSaving && <Loader2 className="h-5 w-5 animate-spin" />}
              {isSaving ? "Saving…" : "Save Job Role"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Hydrate creator when editing an existing brief. */
export function roleBriefToCreatorState(brief: RoleBrief) {
  return {
    jobDescription: brief.job_description ?? "",
    analysis: analysisFromRoleBrief(brief),
    title: brief.title,
    scoringPrompt: {
      scoring_prompt: brief.scoring_prompt,
      scoring_prompt_generated_at: brief.scoring_prompt_generated_at,
      scoring_prompt_version: brief.scoring_prompt_version,
    },
    analysisMeta: {
      job_description_hash: brief.job_description_hash,
      analysis_version: brief.analysis_version,
      last_analysed_at: brief.last_analysed_at,
    },
    analysedJobDescription: brief.job_description ?? "",
  };
}
