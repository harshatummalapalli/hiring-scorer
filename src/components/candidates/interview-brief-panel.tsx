"use client";

import { useEffect, useState } from "react";
import { Printer, X } from "lucide-react";
import type { InterviewBrief } from "@/types/score";

type InterviewBriefPanelProps = {
  candidateId: string;
  savedScoreId: string;
  candidateName: string;
  roleTitle: string;
  onClose: () => void;
};

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

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4">
      <div className="h-3 w-1/3 rounded bg-[#E2E8F0]" />
      <div className="mt-3 h-4 w-full rounded bg-[#E2E8F0]" />
      <div className="mt-2 h-4 w-5/6 rounded bg-[#E2E8F0]" />
    </div>
  );
}

export function InterviewBriefPanel({
  candidateId,
  savedScoreId,
  candidateName,
  roleTitle,
  onClose,
}: InterviewBriefPanelProps) {
  const [brief, setBrief] = useState<InterviewBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setBrief(null);
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
        if (!cancelled) {
          setBrief(json.brief ?? null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to generate interview brief",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [candidateId, savedScoreId]);

  return (
    <div
      className="interview-brief-overlay fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="interview-brief-title"
    >
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .interview-brief-overlay,
          .interview-brief-overlay * {
            visibility: visible;
          }
          .interview-brief-overlay {
            position: absolute;
            inset: 0;
            background: white !important;
            padding: 0 !important;
          }
          .interview-brief-panel {
            max-width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
            border: none !important;
            border-radius: 0 !important;
            font-family: Georgia, "Times New Roman", serif !important;
          }
          .interview-brief-no-print {
            display: none !important;
          }
          .interview-brief-print-expand {
            display: block !important;
          }
          .interview-brief-card {
            background: white !important;
            border-color: #ccc !important;
          }
        }
      `}</style>

      <div
        className="interview-brief-panel flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="interview-brief-no-print flex shrink-0 items-start justify-between gap-3 border-b border-[#E2E8F0] px-5 py-4">
          <div>
            <h2
              id="interview-brief-title"
              className="text-base font-medium text-[#1E293B]"
            >
              Interview Brief
            </h2>
            <p className="mt-0.5 text-sm text-[#64748B]">
              {candidateName} → {roleTitle}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg p-2 text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#1E293B]"
              title="Print"
              aria-label="Print interview brief"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#1E293B]"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <div className="space-y-4">
              <p className="text-sm text-[#64748B]">Preparing interview brief...</p>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {error && !loading && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {brief && !loading && (
            <div className="space-y-4">
              <section className="interview-brief-card rounded-lg border border-[#E2E8F0] border-l-4 border-l-[#0D9488] bg-[#F8FAFC] px-4 py-3">
                <h3 className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
                  Interview Focus
                </h3>
                <p className="mt-1 text-sm font-semibold text-[#1E293B]">
                  {brief.interview_focus}
                </p>
              </section>

              <section className="interview-brief-card rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                <p className="text-sm leading-relaxed text-[#334155]">
                  {brief.candidate_context}
                </p>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-medium text-[#1E293B]">Questions</h3>
                {brief.questions.map((q, i) => {
                  const expanded = expandedQ === i;
                  return (
                    <div
                      key={i}
                      className="interview-brief-card rounded-lg border border-[#E2E8F0] bg-white"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedQ(expanded ? null : i)}
                        className="w-full px-4 py-3 text-left"
                      >
                        <QuestionHeader q={q} index={i} />
                      </button>
                      <div
                        className={`border-t border-[#F1F5F9] px-4 pb-4 ${
                          expanded
                            ? "block"
                            : "hidden interview-brief-print-expand"
                        }`}
                      >
                        <FollowUpsAndRubric q={q} />
                      </div>
                    </div>
                  );
                })}
              </section>

              {brief.red_flags_to_watch.length > 0 && (
                <section className="interview-brief-card rounded-lg border border-[#E2E8F0] border-l-4 border-l-red-400 bg-[#F8FAFC] px-4 py-3">
                  <h3 className="text-sm font-medium text-[#1E293B]">Watch For</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#334155]">
                    {brief.red_flags_to_watch.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}

              {brief.sell_points.length > 0 && (
                <section className="interview-brief-card rounded-lg border border-[#E2E8F0] border-l-4 border-l-emerald-400 bg-[#F8FAFC] px-4 py-3">
                  <h3 className="text-sm font-medium text-[#1E293B]">
                    If Closing This Candidate
                  </h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#334155]">
                    {brief.sell_points.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="interview-brief-card grid gap-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 sm:grid-cols-3">
                <div>
                  <h4 className="text-xs font-semibold uppercase text-emerald-700">
                    Hire signal
                  </h4>
                  <p className="mt-1 text-sm text-[#334155]">
                    {brief.post_interview_verdict_guide.hire_signal}
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase text-amber-700">
                    Borderline
                  </h4>
                  <p className="mt-1 text-sm text-[#334155]">
                    {brief.post_interview_verdict_guide.borderline_signal}
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase text-red-600">
                    Pass signal
                  </h4>
                  <p className="mt-1 text-sm text-[#334155]">
                    {brief.post_interview_verdict_guide.pass_signal}
                  </p>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionHeader({
  q,
  index,
}: {
  q: InterviewBrief["questions"][number];
  index: number;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0D9488] text-xs font-semibold text-white">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="text-sm font-medium text-[#1E293B]">{q.question}</p>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${dimensionBadgeClass(q.maps_to_dimension)}`}
          >
            {q.maps_to_dimension.replace(/_/g, " ")}
          </span>
        </div>
        <p className="mt-1 text-xs text-[#64748B]">{q.why_this_question}</p>
      </div>
    </div>
  );
}

function FollowUpsAndRubric({
  q,
}: {
  q: InterviewBrief["questions"][number];
}) {
  return (
    <>
      {q.probes.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-[#64748B]">Follow-up probes:</p>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-[#334155]">
            {q.probes.map((probe, j) => (
              <li key={j}>{probe}</li>
            ))}
          </ol>
        </div>
      )}
      <div className="mt-3">
        <p className="text-xs font-medium text-[#64748B]">Scoring rubric:</p>
        <ul className="mt-2 space-y-2 text-sm">
          <li>
            <span className="font-medium text-emerald-700">★★★★★ Exceptional:</span>{" "}
            <span className="text-[#334155]">{q.rubric.exceptional}</span>
          </li>
          <li>
            <span className="font-medium text-[#0D9488]">★★★★ Strong:</span>{" "}
            <span className="text-[#334155]">{q.rubric.strong}</span>
          </li>
          <li>
            <span className="font-medium text-amber-700">★★★ Adequate:</span>{" "}
            <span className="text-[#334155]">{q.rubric.adequate}</span>
          </li>
          <li>
            <span className="font-medium text-red-600">★★ Weak:</span>{" "}
            <span className="text-[#334155]">{q.rubric.weak}</span>
          </li>
        </ul>
      </div>
    </>
  );
}
