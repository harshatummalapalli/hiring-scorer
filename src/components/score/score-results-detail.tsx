"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Users,
} from "lucide-react";
import type { RoleBrief } from "@/types/role-brief";
import type {
  AttributedFlag,
  CandidateScoreResult,
  DimensionKey,
} from "@/types/score";
import { toRecruiterConfidenceLabel } from "@/lib/scoring/recruiter-labels";
import {
  MODEL_CONSENSUS_DESCRIPTION,
  MODEL_ROLE_LABELS,
} from "@/types/score";
import { DimensionBreakdown } from "./dimension-breakdown";
import { ModelRawResponsesPanel } from "./model-raw-responses";
import { SkillsIntelligencePanel } from "./skills-intelligence-panel";

const DIMENSION_KEYS: DimensionKey[] = [
  "skills",
  "trajectory",
  "domain",
  "seniority",
  "tenure",
];

type ScoreResultsDetailProps = {
  result: CandidateScoreResult;
  roleBrief: RoleBrief;
};

function weightFor(key: DimensionKey, brief: RoleBrief): number {
  return {
    skills: brief.weight_skills,
    trajectory: brief.weight_trajectory,
    domain: brief.weight_domain,
    seniority: brief.weight_seniority,
    tenure: brief.weight_tenure,
  }[key];
}

/** Power-user breakdown: dimensions, models, raw signals. */
export function ScoreResultsDetail({
  result,
  roleBrief,
}: ScoreResultsDetailProps) {
  const confidenceLabel = toRecruiterConfidenceLabel(result.confidence_label);

  return (
    <div className="space-y-6 border-t border-slate-200 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Overall score</p>
          <p className="text-4xl font-bold tabular-nums tracking-tight text-slate-900">
            {result.overall_score}
            {result.overall_provisional && (
              <span className="text-2xl font-semibold text-amber-600">*</span>
            )}
          </p>
          {result.overall_provisional && (
            <p className="mt-1 max-w-md text-xs text-amber-800">
              Provisional — one or more dimensions need review
            </p>
          )}
        </div>
        <span className="rounded-full bg-slate-200 px-3 py-1 text-sm font-medium text-slate-700">
          {confidenceLabel}
        </span>
      </div>

      {result.skills_intelligence && (
        <SkillsIntelligencePanel intelligence={result.skills_intelligence} />
      )}

      <section className="rounded-lg border border-slate-100 bg-slate-50 p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Users className="h-4 w-4" aria-hidden />
          Evaluator pipeline
        </h3>
        <p className="text-xs text-slate-600">{MODEL_CONSENSUS_DESCRIPTION}</p>
        <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
          <li>{MODEL_ROLE_LABELS.gemini}</li>
          <li>{MODEL_ROLE_LABELS.claude}</li>
          <li>{MODEL_ROLE_LABELS.gpt4o}</li>
        </ul>
      </section>

      {result.dissent_signals.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="text-sm font-semibold text-amber-900">
            Dissenting signals
          </h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-800">
            {result.dissent_signals.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Dimension scores
        </h3>
        <ul className="space-y-3">
          {DIMENSION_KEYS.map((key) => {
            const dim = result.dimension_scores[key];
            const detail = result.dimension_consensus.find((d) => d.key === key);
            if (!detail) return null;

            const isProvisional =
              dim.provisional ?? detail.agreement === "divergent";

            return (
              <DimensionBreakdown
                key={key}
                dimensionKey={key}
                detail={detail}
                displayScore={dim.score}
                isProvisional={isProvisional}
                weight={weightFor(key, roleBrief)}
              />
            );
          })}
        </ul>
      </section>

      <ModelRawResponsesPanel raw={result.model_raw_responses} />

      <AttributedFlagSection
        title="Green flags"
        items={result.green_flags}
        icon={CheckCircle2}
        emptyText="No green flags identified."
        tone="green"
      />
      <AttributedFlagSection
        title="Watch signals"
        items={result.watch_signals}
        icon={Eye}
        emptyText="No watch signals."
        tone="amber"
      />
      <AttributedFlagSection
        title="Review flags"
        items={result.review_flags}
        icon={AlertTriangle}
        emptyText="No review flags."
        tone="red"
      />

      {result.review_recommended && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-medium">What each model flagged</p>
          <ul className="mt-2 space-y-2 text-xs">
            <li>
              <strong>{MODEL_ROLE_LABELS.gemini} — watch signals:</strong>{" "}
              {result.model_flags.gemini.watch_signals.length > 0
                ? result.model_flags.gemini.watch_signals.join("; ")
                : "No watch signals"}
            </li>
            <li>
              <strong>{MODEL_ROLE_LABELS.claude} — risks:</strong>{" "}
              {result.model_flags.claude.risks.join("; ") || "None"}
            </li>
            <li>
              <strong>{MODEL_ROLE_LABELS.claude} — gaps:</strong>{" "}
              {result.model_flags.claude.gaps.join("; ") || "None"}
            </li>
            <li>
              <strong>{MODEL_ROLE_LABELS.gpt4o} — insufficient data:</strong>{" "}
              {result.model_flags.gpt4o.insufficient.join(", ") || "None"}
            </li>
          </ul>
        </section>
      )}
    </div>
  );
}

function AttributedFlagSection({
  title,
  items,
  icon: Icon,
  emptyText,
  tone,
}: {
  title: string;
  items: AttributedFlag[];
  icon: React.ComponentType<{ className?: string }>;
  emptyText: string;
  tone: "green" | "amber" | "red";
}) {
  const colors = {
    green: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
  };

  const badgeColors = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
        <Icon className={`h-4 w-4 ${colors[tone]}`} aria-hidden />
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li
              key={`${title}-${i}`}
              className="flex flex-wrap items-start gap-2 text-sm text-slate-700"
            >
              <span className="flex-1">{item.text}</span>
              {item.sourceLabel ? (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badgeColors[tone]}`}
                >
                  {item.sourceLabel}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
