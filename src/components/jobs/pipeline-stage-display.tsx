"use client";

import { EvaluatingDots } from "@/components/ui/evaluating-dots";
import { SkillPill } from "@/components/ui/skill-pill";

type PipelineStageDisplayProps = {
  stage: "parsing" | "scoring";
  displayName?: string;
  titleLine?: string | null;
  skills?: string[];
  yearsExperience?: string | null;
};

export function PipelineStageDisplay({
  stage,
  displayName,
  titleLine,
  skills = [],
  yearsExperience,
}: PipelineStageDisplayProps) {
  if (stage === "parsing") {
    return (
      <div className="space-y-1">
        <p className="inline-flex items-center gap-2 text-xs text-slate-500">
          <EvaluatingDots />
          Reading resume...
        </p>
        <p className="text-[11px] text-slate-400">Step 1 of 2</p>
      </div>
    );
  }

  const topSkills = skills.filter(Boolean).slice(0, 3);

  return (
    <div className="min-w-0 space-y-2">
      <p className="text-xs font-medium text-emerald-600">✓ Profile extracted</p>
      <p className="inline-flex items-center gap-2 text-xs text-slate-500">
        <EvaluatingDots />
        Scoring against role...
      </p>
      <p className="text-[11px] text-slate-400">Step 2 of 2</p>
      {(displayName || titleLine || topSkills.length > 0 || yearsExperience) && (
        <div className="space-y-1 pt-1">
          {displayName && (
            <p className="truncate text-sm font-medium text-[#1E293B]">
              {displayName}
            </p>
          )}
          {titleLine && (
            <p className="truncate text-xs text-[#64748B]">{titleLine}</p>
          )}
          {topSkills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {topSkills.map((skill) => (
                <SkillPill key={skill} skill={skill} />
              ))}
            </div>
          )}
          {yearsExperience?.trim() && (
            <p className="text-xs text-[#64748B]">{yearsExperience.trim()}</p>
          )}
        </div>
      )}
    </div>
  );
}
