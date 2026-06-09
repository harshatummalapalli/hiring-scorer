"use client";

import { karta } from "@/lib/brand/karta";

export type OutcomeFunnelStats = {
  aiRecommendedInterview: number;
  shortlisted: number;
  passed: number;
  conversionToShortlist: number;
};

type OutcomeFunnelProps = {
  funnel: OutcomeFunnelStats;
};

export function OutcomeFunnel({ funnel }: OutcomeFunnelProps) {
  const steps = [
    {
      label: "AI recommended interview",
      value: funnel.aiRecommendedInterview,
      color: "text-violet-600",
      bar: "bg-violet-500",
    },
    {
      label: "Shortlisted",
      value: funnel.shortlisted,
      color: "text-emerald-600",
      bar: "bg-emerald-500",
    },
    {
      label: "Passed / not a fit",
      value: funnel.passed,
      color: "text-slate-600",
      bar: "bg-slate-400",
    },
  ];

  const max = Math.max(
    funnel.aiRecommendedInterview,
    funnel.shortlisted,
    funnel.passed,
    1,
  );

  return (
    <section className={`${karta.card} p-5`}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[#1E293B]">
            Outcome funnel
          </h2>
          <p className="mt-1 text-sm text-[#64748B]">
            How AI recommendations translate into recruiter actions
          </p>
        </div>
        {funnel.aiRecommendedInterview > 0 && (
          <p className="text-sm font-semibold text-teal-700">
            {funnel.conversionToShortlist}% shortlisted of AI interview picks
          </p>
        )}
      </div>

      <ul className="mt-5 space-y-4">
        {steps.map((step) => (
          <li key={step.label}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-[#64748B]">{step.label}</span>
              <span className={`font-semibold tabular-nums ${step.color}`}>
                {step.value}
              </span>
            </div>
            <div className={`mt-1.5 ${karta.barTrack}`}>
              <div
                className={`${karta.barFill} ${step.bar}`}
                style={{
                  width: `${Math.round((step.value / max) * 100)}%`,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
