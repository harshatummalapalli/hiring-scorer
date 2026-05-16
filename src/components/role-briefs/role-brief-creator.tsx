"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { AnalysisCards } from "@/components/role-briefs/analysis-cards";
import { getErrorMessage } from "@/lib/errors";
import type { RoleBrief, RoleBriefAnalysis } from "@/types/role-brief";
import {
  analysisFromRoleBrief,
  deriveTitleFromAnalysis,
  emptyAnalysis,
} from "@/types/role-brief";

type RoleBriefCreatorProps = {
  initialJobDescription?: string;
  initialAnalysis?: RoleBriefAnalysis | null;
  initialTitle?: string;
  editingId?: string | null;
  onSave: (data: {
    title: string;
    jobDescription: string;
    analysis: RoleBriefAnalysis;
  }) => Promise<void>;
  isSaving: boolean;
};

export function RoleBriefCreator({
  initialJobDescription = "",
  initialAnalysis = null,
  initialTitle = "",
  editingId = null,
  onSave,
  isSaving,
}: RoleBriefCreatorProps) {
  const [jobDescription, setJobDescription] = useState(initialJobDescription);
  const [analysis, setAnalysis] = useState<RoleBriefAnalysis | null>(
    initialAnalysis,
  );
  const [title, setTitle] = useState(initialTitle);
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyse = async () => {
    if (!jobDescription.trim()) {
      setError("Paste a job description first.");
      return;
    }

    setAnalysing(true);
    setError(null);

    try {
      const res = await fetch("/api/analyse-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobDescription: jobDescription.trim() }),
      });
      const data = (await res.json()) as {
        error?: string;
        analysis?: RoleBriefAnalysis;
        title?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");

      const next = data.analysis ?? emptyAnalysis();
      setAnalysis(next);
      setTitle(data.title ?? deriveTitleFromAnalysis(next, jobDescription));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to analyse job description"));
    } finally {
      setAnalysing(false);
    }
  };

  const handleSave = async () => {
    if (!analysis) {
      setError("Analyse the job description before saving.");
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
    });
  };

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
        <label
          htmlFor="job-description"
          className="block text-base font-semibold text-slate-900"
        >
          Paste your complete job description here
        </label>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
          Include everything — the title, responsibilities, requirements, and
          any context about the company or team.
        </p>
        <textarea
          id="job-description"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          rows={14}
          placeholder="Paste the full job description…"
          className="mt-6 w-full resize-y rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-4 text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-200"
        />

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => void handleAnalyse()}
            disabled={analysing || !jobDescription.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-8 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {analysing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
            {analysing ? "Analysing…" : "Analyse Role"}
          </button>
          {analysis && (
            <p className="text-sm text-slate-500">
              Review and edit the extracted signals below, then save.
            </p>
          )}
        </div>

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
          />

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-8">
            <p className="text-sm text-slate-500">
              {editingId ? "Update this role brief in Supabase." : "Save as a new role brief."}
            </p>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-8 py-3.5 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isSaving && <Loader2 className="h-5 w-5 animate-spin" />}
              {isSaving ? "Saving…" : "Save Role Brief"}
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
  };
}
