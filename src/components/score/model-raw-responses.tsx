"use client";

import { useState } from "react";
import { ChevronDown, Code2 } from "lucide-react";
import type { ModelRawResponses } from "@/types/score";

type ModelRawResponsesPanelProps = {
  raw: ModelRawResponses;
};

export function ModelRawResponsesPanel({ raw }: ModelRawResponsesPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const payload = raw.gpt4o;

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-slate-800 transition hover:bg-slate-100/80"
      >
        <span className="inline-flex items-center gap-2">
          <Code2 className="h-4 w-4 text-slate-500" aria-hidden />
          Full scoring response (technical)
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {expanded && (
        <div className="border-t border-slate-200 px-4 pb-4">
          <p className="mt-2 text-xs text-slate-500">
            Parsed JSON returned by Kharta for this scoring run.
          </p>
          <pre className="mt-3 max-h-96 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}
