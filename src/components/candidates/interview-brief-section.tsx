"use client";

import { useEffect, useState } from "react";
import { Check, ClipboardList, Copy, Loader2, RefreshCw } from "lucide-react";
import type { InterviewBrief } from "@/types/score";
import { formatInterviewBriefText } from "@/lib/interview-brief/format-brief-text";
import { karta } from "@/lib/brand/karta";

type InterviewBriefSectionProps = {
  candidateId: string;
  savedScoreId: string;
  candidateName: string;
  roleTitle: string;
  storedBrief: InterviewBrief | null;
  onBriefStored: (brief: InterviewBrief) => void;
  onError: (message: string) => void;
};

export function InterviewBriefSection({
  candidateId,
  savedScoreId,
  candidateName,
  roleTitle,
  storedBrief,
  onBriefStored,
  onError,
}: InterviewBriefSectionProps) {
  const [brief, setBrief] = useState<InterviewBrief | null>(storedBrief);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setBrief(storedBrief);
  }, [storedBrief]);
  const [copied, setCopied] = useState(false);
  const [showAllQuestions, setShowAllQuestions] = useState(false);

  const displayBrief = brief ?? storedBrief;

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

  const visibleQuestions = showAllQuestions
    ? (displayBrief?.questions ?? [])
    : (displayBrief?.questions ?? []).slice(0, 2);

  return (
    <section className={`${karta.card} p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={karta.sectionHeading}>Interview</h3>
        {displayBrief && (
          <div className="flex flex-wrap gap-2">
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
            <button
              type="button"
              disabled={loading}
              onClick={() => void generate()}
              className={`inline-flex items-center gap-1.5 ${karta.btnSecondary} px-2 py-1 text-xs`}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Regenerate
            </button>
          </div>
        )}
      </div>

      {!displayBrief ? (
        <div className="mt-4 text-center">
          <p className="text-sm text-[#64748B]">
            Generate a focused interview brief from this candidate&apos;s score
            and role requirements.
          </p>
          <button
            type="button"
            disabled={loading}
            onClick={() => void generate()}
            className={`mt-3 inline-flex items-center gap-2 ${karta.btnOutlineTeal}`}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ClipboardList className="h-4 w-4" />
            )}
            Generate Interview Brief
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="rounded-lg border border-[#E2E8F0] border-l-4 border-l-[#0D9488] bg-[#F8FAFC] px-3 py-2">
            <p className="text-xs font-semibold uppercase text-[#0D9488]">
              Interview focus
            </p>
            <p className="mt-1 text-sm text-[#334155]">
              {displayBrief.interview_focus}
            </p>
          </div>
          <p className="text-sm text-[#64748B]">{displayBrief.candidate_context}</p>
          <ol className="list-decimal space-y-3 pl-5 text-sm text-[#334155]">
            {visibleQuestions.map((q, i) => (
              <li key={i}>
                <p className="font-medium text-[#1E293B]">{q.question}</p>
                <p className="mt-0.5 text-xs text-[#64748B]">
                  {q.why_this_question}
                </p>
              </li>
            ))}
          </ol>
          {(displayBrief.questions.length ?? 0) > 2 && (
            <button
              type="button"
              onClick={() => setShowAllQuestions((v) => !v)}
              className="text-sm font-medium text-[#0D9488] hover:text-[#0B8276]"
            >
              {showAllQuestions
                ? "Show fewer questions"
                : `Show all ${displayBrief.questions.length} questions`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
