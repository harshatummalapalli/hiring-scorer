"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type { RoleBrief } from "@/types/role-brief";
import type { CandidateScoreResult, FitVerdict } from "@/types/score";
import { formatSkillsMatchSummary } from "@/lib/intelligence/semantic-matcher";
import {
  buildFallbackRecruiterCard,
  scoreToVerdict,
} from "@/lib/scoring/recruiter-card";
import { normalizeInterviewQuestions } from "@/lib/scoring/interview-questions";
import { ScoreResultsDetail } from "./score-results-detail";

type CandidateScoreCardProps = {
  result: CandidateScoreResult;
  roleBrief: RoleBrief;
  candidateFilename: string;
  hideHeader?: boolean;
  compact?: boolean;
  onScreen?: () => void | Promise<void>;
  onPass?: () => void | Promise<void>;
  onSaveToPipeline?: () => void | Promise<void>;
  actionBusy?: boolean;
  savedLabel?: string | null;
};

const VERDICT_STYLES: Record<
  FitVerdict,
  { text: string; ring: string; bg: string }
> = {
  "STRONG FIT": {
    text: "text-emerald-700",
    ring: "ring-emerald-200",
    bg: "bg-emerald-50",
  },
  "POSSIBLE FIT": {
    text: "text-amber-700",
    ring: "ring-amber-200",
    bg: "bg-amber-50",
  },
  "WEAK FIT": {
    text: "text-orange-700",
    ring: "ring-orange-200",
    bg: "bg-orange-50",
  },
  "NOT SUITABLE": {
    text: "text-red-700",
    ring: "ring-red-200",
    bg: "bg-red-50",
  },
};

export function CandidateScoreCard({
  result,
  roleBrief,
  candidateFilename,
  hideHeader = false,
  compact = false,
  onScreen,
  onPass,
  onSaveToPipeline,
  actionBusy = false,
  savedLabel = null,
}: CandidateScoreCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  const card =
    result.recruiter_card ??
    buildFallbackRecruiterCard(
      candidateFilename,
      [
        ...result.review_flags.map((f) => f.text),
        ...result.watch_signals.map((f) => f.text),
        ...result.gaps.map((f) => f.text),
      ],
      result.model_flags.claude.gaps.length > 0
        ? normalizeInterviewQuestions(
            result.model_flags.claude.gaps.map(
              (g) => `Can you walk me through how you would address: ${g}`,
            ),
          )
        : [],
    );

  const { candidate_header, what_stands_out, worth_exploring, interview_questions } =
    card;
  const verdict = scoreToVerdict(result.overall_score);
  const verdictStyle = VERDICT_STYLES[verdict];
  const skillsMatchSummary = result.skills_intelligence
    ? formatSkillsMatchSummary(result.skills_intelligence)
    : null;
  const verdictSize = compact
    ? "text-2xl font-bold tracking-wide"
    : "text-3xl font-bold tracking-wide sm:text-4xl";

  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className={compact ? "space-y-6 p-5" : "space-y-10 p-8 sm:p-10"}>
        {!hideHeader && (
          <header className="space-y-4 border-b border-slate-100 pb-8">
          <h2 className="text-[24px] font-semibold leading-[1.2] tracking-tight text-[#1E293B]">
            {candidate_header.display_name}
          </h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Most recent title</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {candidate_header.most_recent_title}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Total experience</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {candidate_header.total_years_experience}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Career pattern</dt>
              <dd className="mt-0.5 font-medium text-slate-900">
                {candidate_header.career_pattern}
              </dd>
            </div>
          </dl>
          </header>
        )}

        {/* Verdict */}
        <section
          className={`rounded-xl px-4 py-5 text-center ring-1 ${verdictStyle.bg} ${verdictStyle.ring} ${compact ? "" : "rounded-2xl px-6 py-8"}`}
          aria-label={`Verdict: ${verdict}`}
        >
          <p className={`${verdictSize} ${verdictStyle.text}`}>
            {verdict}
          </p>
          <p className="sr-only">Score {result.overall_score} out of 100</p>
          {skillsMatchSummary && (
            <p className="mt-5 text-center text-sm font-medium leading-relaxed text-slate-600">
              {skillsMatchSummary}
            </p>
          )}
        </section>

        {/* Section 3 — what stands out */}
        {what_stands_out.length > 0 && (
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Why This Candidate
            </h3>
            <ul className="space-y-6">
              {what_stands_out.map((item, i) => (
                <li key={i} className="space-y-2">
                  <p className="text-base leading-relaxed text-slate-800">
                    {item.signal}
                  </p>
                  <p className="border-l-2 border-slate-200 pl-4 text-sm italic leading-relaxed text-slate-600">
                    &ldquo;{item.evidence}&rdquo;
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Section 4 — worth exploring */}
        {worth_exploring.length > 0 && (
          <section className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Worth exploring
            </h3>
            <ul className="list-disc space-y-3 pl-5 text-base leading-relaxed text-slate-800">
              {worth_exploring.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>
        )}

        {/* Section 5 — ask in your screen */}
        <section className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Ask in your screen
          </h3>
          <ol className="list-decimal space-y-4 pl-5 text-base leading-relaxed text-slate-800">
            {interview_questions.slice(0, 2).map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </section>

        {/* Section 6 — actions */}
        {(onScreen || onPass || onSaveToPipeline) && (
          <section className="flex flex-wrap gap-3 border-t border-slate-100 pt-8">
            {onScreen && (
              <button
                type="button"
                onClick={() => void onScreen()}
                disabled={actionBusy}
                className="inline-flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50 sm:flex-none"
              >
                {actionBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                Screen This Candidate
              </button>
            )}
            {onPass && (
              <button
                type="button"
                onClick={() => void onPass()}
                disabled={actionBusy}
                className="inline-flex flex-1 min-w-[100px] items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:flex-none"
              >
                Pass
              </button>
            )}
            {onSaveToPipeline && (
              <button
                type="button"
                onClick={() => void onSaveToPipeline()}
                disabled={actionBusy}
                className="inline-flex flex-1 min-w-[140px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 sm:flex-none"
              >
                {actionBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                Shortlist
              </button>
            )}
            {savedLabel && (
              <p className="w-full text-sm text-emerald-700">{savedLabel}</p>
            )}
          </section>
        )}
      </div>

      {/* Section 7 — detailed analysis toggle */}
      <div className="border-t border-slate-200 bg-slate-50/80">
        <button
          type="button"
          onClick={() => setDetailOpen((o) => !o)}
          className="flex w-full items-center justify-center gap-2 px-6 py-4 text-sm font-medium text-slate-600 transition hover:bg-slate-100/80 hover:text-slate-900"
          aria-expanded={detailOpen}
        >
          See Full Breakdown
          {detailOpen ? (
            <ChevronUp className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden />
          )}
        </button>
        {detailOpen && (
          <div className="border-t border-slate-200 bg-white px-6 pb-10 pt-2 sm:px-10">
            <ScoreResultsDetail result={result} roleBrief={roleBrief} />
          </div>
        )}
      </div>
    </article>
  );
}
