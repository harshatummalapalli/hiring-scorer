"use client";

import { AlertTriangle, BrainCircuit, CheckCircle2 } from "lucide-react";
import type { SkillsIntelligence, SkillMatchResult } from "@/lib/intelligence/semantic-matcher";

type SkillsIntelligencePanelProps = {
  intelligence: SkillsIntelligence;
};

function SkillMatchRow({ match }: { match: SkillMatchResult }) {
  if (match.match_type === "direct") {
    return (
      <li className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-4">
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
            aria-hidden
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium text-slate-900">{match.skill}</p>
            <p className="text-sm text-emerald-800">Direct match</p>
            {match.matched_term && (
              <p className="text-sm text-slate-700">
                Found as:{" "}
                <span className="font-medium">&ldquo;{match.matched_term}&rdquo;</span>
              </p>
            )}
            {match.context_quote && (
              <p className="border-l-2 border-emerald-200 pl-3 text-sm italic text-slate-600">
                &ldquo;{match.context_quote}&rdquo;
              </p>
            )}
          </div>
        </div>
      </li>
    );
  }

  if (match.match_type === "semantic") {
    return (
      <li className="rounded-lg border border-blue-100 bg-blue-50/60 p-4">
        <div className="flex items-start gap-3">
          <BrainCircuit
            className="mt-0.5 h-5 w-5 shrink-0 text-blue-600"
            aria-hidden
          />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium text-slate-900">{match.skill}</p>
            <p className="text-sm text-blue-800">
              Semantic match — skill inferred from equivalent technology
            </p>
            {match.matched_term && (
              <p className="text-sm text-slate-700">
                Equivalent found:{" "}
                <span className="font-medium">&ldquo;{match.matched_term}&rdquo;</span>
              </p>
            )}
            {match.context_quote && (
              <p className="border-l-2 border-blue-200 pl-3 text-sm italic text-slate-600">
                &ldquo;{match.context_quote}&rdquo;
              </p>
            )}
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-amber-100 bg-amber-50/60 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium text-slate-900">{match.skill}</p>
          <p className="text-sm text-amber-800">
            Not found — neither the skill nor a known equivalent appears on the resume
          </p>
        </div>
      </div>
    </li>
  );
}

export function SkillsIntelligencePanel({
  intelligence,
}: SkillsIntelligencePanelProps) {
  if (intelligence.total_required === 0) {
    return (
      <section className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
        <h3 className="font-semibold text-slate-800">Skills intelligence</h3>
        <p className="mt-1">
          No required skills with semantic clusters are defined on this role brief.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Skills intelligence
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          How required skills from the role brief map to this resume — including semantic
          inference via equivalent technologies.
        </p>
      </div>
      <ul className="space-y-3">
        {intelligence.matches.map((match) => (
          <SkillMatchRow key={match.skill} match={match} />
        ))}
      </ul>
    </section>
  );
}
