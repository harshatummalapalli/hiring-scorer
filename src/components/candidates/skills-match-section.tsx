"use client";

import { Check, Sparkles, AlertTriangle } from "lucide-react";
import type { SkillsIntelligence } from "@/lib/intelligence/semantic-matcher";
import { karta } from "@/lib/brand/karta";

type SkillsMatchSectionProps = {
  intel: SkillsIntelligence;
};

export function SkillsMatchSection({ intel }: SkillsMatchSectionProps) {
  return (
    <section className={`${karta.card} p-4`}>
      <h3 className={karta.sectionHeading}>Skills Match</h3>
      <div className="mt-2 space-y-2">
        <div>
          <div className="mb-1 flex justify-between text-[13px]">
            <span className="font-medium text-[#334155]">Must-haves met</span>
            <span className="text-[#64748B]">
              {intel.matched_count} of {intel.total_required}
            </span>
          </div>
          <div className={karta.barTrack}>
            <div
              className={karta.barFill}
              style={{
                width: `${Math.min(
                  100,
                  (intel.matched_count / Math.max(1, intel.total_required)) *
                    100,
                )}%`,
              }}
            />
          </div>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {intel.matches.map((m) => (
          <li
            key={m.skill}
            className="flex items-start gap-2 text-sm text-[#334155]"
          >
            {m.match_type === "direct" && (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#059669]" />
            )}
            {m.match_type === "semantic" && (
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            )}
            {m.match_type === "not_found" && (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            )}
            <span>
              <span className="font-medium">{m.skill}</span>
              {m.match_type === "semantic" && m.matched_term && (
                <span className="text-[#64748B]"> — via {m.matched_term}</span>
              )}
              {m.match_type === "not_found" && (
                <span className="text-[#64748B]"> — not found</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
