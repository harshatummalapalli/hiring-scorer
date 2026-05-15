"use client";

import { useState } from "react";
import { Bug, ChevronDown, X } from "lucide-react";
import { useScoringDebug } from "@/contexts/scoring-debug-context";
import { MODEL_ROLE_LABELS } from "@/types/score";
import type { ScoringDebugLogEntry } from "@/types/scoring-debug";

const RAW_TABS = [
  { id: "gpt4o" as const, label: MODEL_ROLE_LABELS.gpt4o },
  { id: "claude" as const, label: MODEL_ROLE_LABELS.claude },
  { id: "gemini" as const, label: MODEL_ROLE_LABELS.gemini },
];

export function ScoringDebugPanel() {
  const { entries, panelOpen, closePanel, clearLog } = useScoringDebug();

  if (!panelOpen) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close debug panel backdrop"
        className="fixed inset-0 z-[60] bg-slate-900/30"
        onClick={closePanel}
      />
      <aside
        className="fixed right-0 top-0 z-[70] flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-labelledby="scoring-debug-title"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-slate-600" aria-hidden />
            <div>
              <h2 id="scoring-debug-title" className="text-sm font-semibold text-slate-900">
                Scoring debug
              </h2>
              <p className="text-xs text-slate-500">
                Session log · recruiter calibration · not saved
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearLog}
              disabled={entries.length === 0}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Clear log
            </button>
            <button
              type="button"
              onClick={closePanel}
              className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {entries.length === 0 ? (
            <p className="text-sm text-slate-500">
              No scoring runs logged yet. Run consensus on a candidate to capture
              configuration, raw model JSON, consensus arithmetic, and the final
              score card output.
            </p>
          ) : (
            <ul className="space-y-4">
              {entries.map((entry) => (
                <DebugLogEntry key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}

function DebugLogEntry({ entry }: { entry: ScoringDebugLogEntry }) {
  const [expanded, setExpanded] = useState(true);
  const time = new Date(entry.timestamp).toLocaleString();
  const status = entry.error ? "Failed" : "OK";

  return (
    <li className="rounded-lg border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">
            {entry.candidateFilename}
          </p>
          <p className="text-xs text-slate-500">
            {time}
            {entry.durationMs != null && ` · ${(entry.durationMs / 1000).toFixed(1)}s`}
            {" · "}
            <span
              className={
                entry.error ? "font-medium text-red-600" : "font-medium text-emerald-700"
              }
            >
              {status}
            </span>
            {" · "}
            {entry.architecture} ({entry.modelCallCount} calls)
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-slate-200 px-3 py-3">
          {entry.error && (
            <section className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
              <strong>Error:</strong> {entry.error}
            </section>
          )}

          <DebugSection title="Configuration">
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-700">
              {entry.configuration}
            </pre>
          </DebugSection>

          <DebugSection
            title={`Raw model responses (${entry.modelCallCount})`}
          >
            {entry.modelRawResponses ? (
              <RawResponsesTabs raw={entry.modelRawResponses} />
            ) : (
              <p className="text-xs text-slate-500">No raw responses captured.</p>
            )}
          </DebugSection>

          <DebugSection title="Consensus calculation (step by step)">
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-700">
              {entry.consensusSteps.join("\n")}
            </pre>
          </DebugSection>

          <DebugSection title="Final score card output">
            {entry.finalResult ? (
              <pre className="max-h-64 overflow-auto rounded-md bg-slate-900 p-3 font-mono text-[10px] leading-relaxed text-slate-100">
                {JSON.stringify(entry.finalResult, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-slate-500">No result object.</p>
            )}
          </DebugSection>
        </div>
      )}
    </li>
  );
}

function DebugSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

function RawResponsesTabs({
  raw,
}: {
  raw: NonNullable<ScoringDebugLogEntry["modelRawResponses"]>;
}) {
  const [tab, setTab] = useState<"gpt4o" | "claude" | "gemini">("gpt4o");

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1">
        {RAW_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded px-2 py-1 text-[10px] font-medium ${
              tab === t.id
                ? "bg-slate-800 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <pre className="max-h-48 overflow-auto rounded-md bg-slate-900 p-2 font-mono text-[10px] leading-relaxed text-slate-100">
        {JSON.stringify(raw[tab], null, 2)}
      </pre>
    </div>
  );
}
