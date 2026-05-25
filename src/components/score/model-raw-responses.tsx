"use client";

import { useState } from "react";
import { ChevronDown, Code2 } from "lucide-react";
import type { ModelRawResponses } from "@/types/score";
import { MODEL_ROLE_LABELS } from "@/types/score";
import { rawResponsesHasLegacyMultiModel } from "./legacy-multi-model-display";

type TabId = "gpt4o" | "claude" | "gemini";

const LEGACY_TABS: { id: TabId; label: string }[] = [
  { id: "gpt4o", label: MODEL_ROLE_LABELS.gpt4o },
  { id: "claude", label: MODEL_ROLE_LABELS.claude },
  { id: "gemini", label: MODEL_ROLE_LABELS.gemini },
];

type ModelRawResponsesPanelProps = {
  raw: ModelRawResponses;
};

export function ModelRawResponsesPanel({ raw }: ModelRawResponsesPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const isLegacyMultiModel = rawResponsesHasLegacyMultiModel(raw);
  const availableLegacyTabs = LEGACY_TABS.filter((t) => raw[t.id] != null);
  const [tab, setTab] = useState<TabId>("gpt4o");

  const panelTitle = isLegacyMultiModel
    ? "Full evaluator responses (technical)"
    : "Full scoring response (technical)";

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-slate-800 transition hover:bg-slate-100/80"
      >
        <span className="inline-flex items-center gap-2">
          <Code2 className="h-4 w-4 text-slate-500" aria-hidden />
          {panelTitle}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {expanded && (
        <div className="border-t border-slate-200 px-4 pb-4">
          <p className="mt-2 text-xs text-slate-500">
            {isLegacyMultiModel
              ? "Parsed JSON returned by each evaluator for this legacy multi-model score."
              : "Parsed JSON returned by GPT-4o mini for this scoring run."}
          </p>

          {isLegacyMultiModel ? (
            <>
              <div className="mt-3 flex flex-wrap gap-1 border-b border-slate-200 pb-2">
                {availableLegacyTabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                      tab === t.id
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
                {JSON.stringify(raw[tab], null, 2)}
              </pre>
            </>
          ) : raw.gpt4o != null ? (
            <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
              {JSON.stringify(raw.gpt4o, null, 2)}
            </pre>
          ) : (
            <p className="mt-3 text-xs text-slate-500">
              No raw JSON was stored for this score.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
