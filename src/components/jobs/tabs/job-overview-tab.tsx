"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { ApplyLinkPanel } from "@/components/jobs/apply-link-panel";
import { PromptStatusBadge } from "@/components/role-briefs/prompt-status-badge";
import { karta } from "@/lib/brand/karta";
import { getErrorMessage } from "@/lib/errors";
import type { Job } from "@/types/job";
import { analysisFromRoleBrief } from "@/types/role-brief";

type JobOverviewTabProps = {
  job: Job;
  onJobUpdated: (job: Job) => void;
  onRegenerateComplete: () => void;
};

export function JobOverviewTab({
  job,
  onJobUpdated,
  onRegenerateComplete,
}: JobOverviewTabProps) {
  const analysis = analysisFromRoleBrief(job);
  const [regenerating, setRegenerating] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patchJob = async (patch: Record<string, unknown>) => {
    const res = await fetch(`/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Update failed");
    onJobUpdated(json.job as Job);
  };

  const handleToggleActive = async () => {
    setTogglingActive(true);
    setError(null);
    try {
      await patchJob({ application_active: !job.application_active });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update"));
    } finally {
      setTogglingActive(false);
    }
  };

  const handleRegeneratePrompt = async () => {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/role-briefs/${job.id}/regenerate-scoring-prompt`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to regenerate");
      onRegenerateComplete();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to regenerate prompt"));
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      <ApplyLinkPanel
        applyLink={job.apply_link}
        applicationToken={job.application_token}
      />

      <section className={`${karta.card} p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-[#64748B]">Applications received</p>
            <p className="text-3xl font-semibold text-[#1E293B]">
              {job.application_count}
            </p>
          </div>
          <label className="flex items-center gap-3 text-sm font-medium text-[#334155]">
            <span>Applications open</span>
            <button
              type="button"
              disabled={togglingActive}
              onClick={() => void handleToggleActive()}
              className={`relative h-7 w-12 rounded-full transition ${
                job.application_active ? "bg-[#0D9488]" : "bg-slate-300"
              }`}
              role="switch"
              aria-checked={job.application_active}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                  job.application_active ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </label>
        </div>
      </section>

      <section className={`${karta.card} p-6 sm:p-8`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={karta.sectionHeading}>Scoring prompt</h3>
            <PromptStatusBadge ready={Boolean(job.scoring_prompt?.trim())} />
          </div>
          <button
            type="button"
            disabled={regenerating}
            onClick={() => void handleRegeneratePrompt()}
            className={`inline-flex items-center gap-2 ${karta.btnOutlineTeal}`}
          >
            {regenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Regenerate Prompt
          </button>
        </div>
        {error && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className={`${karta.card} p-6 sm:p-8 space-y-8`}>
        <div>
          <h3 className={karta.sectionHeading}>Must-haves</h3>
          <ul className="mt-3 space-y-2">
            {analysis.deal_breakers.length === 0 ? (
              <li className="text-sm text-[#64748B]">None extracted</li>
            ) : (
              analysis.deal_breakers.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-[#334155]">
                  <span className="mt-0.5 text-[#0D9488]" aria-hidden>
                    ✓
                  </span>
                  {item}
                </li>
              ))
            )}
          </ul>
        </div>

        <div>
          <h3 className={karta.sectionHeading}>Key requirements</h3>
          <ul className="mt-3 space-y-4">
            {analysis.core_signals.length === 0 ? (
              <li className="text-sm text-[#64748B]">None extracted</li>
            ) : (
              analysis.core_signals.map((signal) => (
                <li key={signal.skill}>
                  <p className="font-medium text-[#1E293B]">{signal.skill}</p>
                  {signal.equivalents.length > 0 && (
                    <p className="mt-1 text-sm text-[#64748B]">
                      Equivalents: {signal.equivalents.join(", ")}
                    </p>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>

        <div>
          <h3 className={karta.sectionHeading}>Nice-to-haves</h3>
          <ul className="mt-3 list-disc pl-5 text-sm text-[#334155]">
            {analysis.preferred_signals.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className={karta.sectionHeading}>Assess in interview</h3>
          <ul className="mt-3 list-disc pl-5 text-sm text-[#334155]">
            {analysis.cannot_assess.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
