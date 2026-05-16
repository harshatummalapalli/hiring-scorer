"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { AnalysisCards } from "@/components/role-briefs/analysis-cards";
import { karta } from "@/lib/brand/karta";
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
      if (!res.ok) throw new Error(data.error ?? "Read JD failed");

      const next = data.analysis ?? emptyAnalysis();
      setAnalysis(next);
      setTitle(data.title ?? deriveTitleFromAnalysis(next, jobDescription));
    } catch (err) {
      setError(getErrorMessage(err, "Failed to read job description"));
    } finally {
      setAnalysing(false);
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
  };
}
