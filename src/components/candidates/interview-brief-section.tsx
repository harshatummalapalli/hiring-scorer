"use client";

import { useEffect, useState } from "react";
import { Check, ClipboardList, Copy, Loader2, RefreshCw } from "lucide-react";
import type { InterviewBrief } from "@/types/score";
import { formatInterviewBriefText } from "@/lib/interview-brief/format-brief-text";
import { karta } from "@/lib/brand/karta";

function dimensionBadgeClass(dimension: string): string {
  const d = dimension.toLowerCase();
  if (d.includes("skill")) return "bg-teal-50 text-[#0D9488]";
  if (d.includes("trajectory")) return "bg-violet-50 text-violet-700";
  if (d.includes("domain")) return "bg-blue-50 text-blue-700";
  if (d.includes("seniority")) return "bg-indigo-50 text-indigo-700";
  if (d.includes("tenure")) return "bg-slate-100 text-slate-600";
  if (d.includes("cannot")) return "bg-amber-50 text-amber-800";
  return "bg-[#F1F5F9] text-[#64748B]";
}

type InterviewBriefSectionProps = {
  candidateId: string;
  savedScoreId: string;
  candidateName: string;
  roleTitle: string;
  storedBrief: InterviewBrief | null;
  roleBriefUpdatedAt?: string | null;
  roleBriefCreatedAt?: string | null;
  onBriefStored: (brief: InterviewBrief) => void;
  onError: (message: string) => void;
  fallbackQuestions?: string[];
};

const REGENERATE_DISABLED_TOOLTIP =
  "Interview brief is up to date for this role. Regeneration is available when the job description is updated or the candidate is evaluated against a different role.";

export function InterviewBriefSection({
  candidateId,
  savedScoreId,
  candidateName,
  roleTitle,
  storedBrief,
  roleBriefUpdatedAt = null,
  roleBriefCreatedAt = null,
  onBriefStored,
  onError,
  fallbackQuestions = [],
}: InterviewBriefSectionProps) {
  const [brief, setBrief] = useState<InterviewBrief | null>(storedBrief);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);

  useEffect(() => {
    setBrief(storedBrief);
  }, [storedBrief]);

  const displayBrief = brief ?? storedBrief;

  const briefGeneratedAt = displayBrief?.generated_at ?? null;
  const roleBriefTimestamp = roleBriefUpdatedAt ?? roleBriefCreatedAt;
  const jdChanged = Boolean(
    roleBriefTimestamp &&
      briefGeneratedAt &&
      new Date(roleBriefTimestamp) > new Date(briefGeneratedAt),
  );
  const canRegenerate = !briefGeneratedAt || jdChanged;

  const generate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/interview-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_id: candidateId,
          saved_score_id: savedScoreId,
        }),
      });
      const json = (await res.json()) as {
        brief?: InterviewBrief;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to generate interview brief");
      }
      if (json.brief) {
        setBrief(json.brief);
        onBriefStored(json.brief);
      }
    } catch (e) {
      onError(
        e instanceof Error ? e.message : "Failed to generate interview brief",
      );
    } finally {
      setLoading(false);
    }
  };

  const copyBrief = async () => {
    if (!displayBrief) return;
    await navigator.clipboard.writeText(
      formatInterviewBriefText(displayBrief, candidateName, roleTitle),
    );
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (!displayBrief) {
    return (
      <div className="space-y-6">
        <div className={`${karta.card} p-6 text-center`}>
          <p className="text-sm text-[#64748B]">
            Generate a focused interview brief based on this candidate&apos;s
            score and the role requirements.
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={() => void generate()}
            className={`mt-4 inline-flex items-center gap-2 ${karta.btnOutlineTeal}`}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ClipboardList className="h-4 w-4" />
            )}
            Generate interview brief
          </button>
        </div>

        {fallbackQuestions.length > 0 && (
          <section className={`${karta.card} p-4`}>
            <h3 className={karta.sectionHeading}>Ask Them</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[#334155]">
              {fallbackQuestions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ol>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => void copyBrief()}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0D9488] hover:text-[#0B8276]"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy brief
            </>
          )}
        </button>
        {jdChanged ? (
          <p className="text-xs text-[#64748B]">
            Role requirements updated since this brief was generated.{" "}
            <button
              type="button"
              disabled={loading}
              onClick={() => void generate()}
              className="inline-flex items-center gap-1 font-medium text-[#0D9488] hover:text-[#0B8276] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Regenerate
            </button>
          </p>
        ) : (
          <button
            type="button"
            disabled={loading || !canRegenerate}
            title={!canRegenerate ? REGENERATE_DISABLED_TOOLTIP : undefined}
            onClick={() => void generate()}
            className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs ${
              canRegenerate
                ? karta.btnSecondary
                : "cursor-not-allowed text-[#94A3B8]"
            }`}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Regenerate
          </button>
        )}
      </div>

      <section className="rounded-lg border border-[#E2E8F0] border-l-4 border-l-[#0D9488] bg-[#F8FAFC] px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#0D9488]">
          Interview Focus
        </h3>
        <p className="mt-1 text-sm font-medium text-[#1E293B]">
          {displayBrief.interview_focus}
        </p>
      </section>

      <section className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
        <p className="text-sm leading-relaxed text-[#334155]">
          {displayBrief.candidate_context}
        </p>
      </section>

      <section className="space-y-3">
        <h3 className={karta.sectionHeading}>Questions</h3>
        {displayBrief.questions.map((q, i) => {
          const expanded = expandedQ === i;
          return (
            <div
              key={i}
              className="rounded-lg border border-[#E2E8F0] bg-white"
            >
              <button
                type="button"
                onClick={() => setExpandedQ(expanded ? null : i)}
                className="w-full px-4 py-3 text-left"
              >
                <div className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0D9488] text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-medium text-[#1E293B]">
                        {q.question}
                      </p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${dimensionBadgeClass(q.maps_to_dimension)}`}
                      >
                        {q.maps_to_dimension.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#64748B]">
                      {q.why_this_question}
                    </p>
                  </div>
                </div>
              </button>
              {expanded && (
                <div className="border-t border-[#F1F5F9] px-4 pb-4">
                  {q.probes.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-[#64748B]">
                        Follow-up probes
                      </p>
                      <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-[#334155]">
                        {q.probes.map((probe, j) => (
                          <li key={j}>{probe}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                  <div className="mt-3">
                    <p className="text-xs font-medium text-[#64748B]">
                      Scoring rubric
                    </p>
                    <ul className="mt-2 space-y-2 text-sm">
                      <li>
                        <span className="font-medium text-emerald-700">
                          Exceptional:
                        </span>{" "}
                        {q.rubric.exceptional}
                      </li>
                      <li>
                        <span className="font-medium text-[#0D9488]">
                          Strong:
                        </span>{" "}
                        {q.rubric.strong}
                      </li>
                      <li>
                        <span className="font-medium text-amber-700">
                          Adequate:
                        </span>{" "}
                        {q.rubric.adequate}
                      </li>
                      <li>
                        <span className="font-medium text-red-600">Weak:</span>{" "}
                        {q.rubric.weak}
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {displayBrief.red_flags_to_watch.length > 0 && (
        <section className="rounded-lg border border-[#E2E8F0] border-l-4 border-l-red-400 bg-[#F8FAFC] px-4 py-3">
          <h3 className="text-sm font-medium text-[#1E293B]">Watch For</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#334155]">
            {displayBrief.red_flags_to_watch.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {displayBrief.sell_points.length > 0 && (
        <section className="rounded-lg border border-[#E2E8F0] border-l-4 border-l-emerald-400 bg-[#F8FAFC] px-4 py-3">
          <h3 className="text-sm font-medium text-[#1E293B]">
            If Closing This Candidate
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#334155]">
            {displayBrief.sell_points.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 sm:grid-cols-3">
        <div>
          <h4 className="text-xs font-semibold uppercase text-emerald-700">
            Hire signal
          </h4>
          <p className="mt-1 text-sm text-[#334155]">
            {displayBrief.post_interview_verdict_guide.hire_signal}
          </p>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase text-amber-700">
            Borderline
          </h4>
          <p className="mt-1 text-sm text-[#334155]">
            {displayBrief.post_interview_verdict_guide.borderline_signal}
          </p>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase text-red-600">
            Pass signal
          </h4>
          <p className="mt-1 text-sm text-[#334155]">
            {displayBrief.post_interview_verdict_guide.pass_signal}
          </p>
        </div>
      </section>
    </div>
  );
}
