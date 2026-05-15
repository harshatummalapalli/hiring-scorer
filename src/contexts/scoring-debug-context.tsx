"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  buildConsensusCalculationSteps,
  buildScoringConfigurationSummary,
  MODEL_CALL_COUNT,
  SCORING_ARCHITECTURE,
} from "@/lib/ai/consensus-debug";
import type { AppendScoringDebugInput, ScoringDebugLogEntry } from "@/types/scoring-debug";

type ScoringDebugContextValue = {
  entries: ScoringDebugLogEntry[];
  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  clearLog: () => void;
  appendRun: (input: AppendScoringDebugInput) => void;
};

const ScoringDebugContext = createContext<ScoringDebugContextValue | null>(null);

function createEntryId(): string {
  return `debug-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ScoringDebugProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<ScoringDebugLogEntry[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);

  const appendRun = useCallback((input: AppendScoringDebugInput) => {
    const configuration = buildScoringConfigurationSummary(input.roleBrief);
    const consensusSteps =
      input.result != null
        ? buildConsensusCalculationSteps(input.result, input.roleBrief)
        : ["Scoring failed before consensus was computed."];

    const entry: ScoringDebugLogEntry = {
      id: createEntryId(),
      timestamp: new Date().toISOString(),
      candidateFilename: input.candidateFilename,
      configuration,
      architecture: SCORING_ARCHITECTURE,
      modelCallCount: MODEL_CALL_COUNT,
      modelRawResponses: input.result?.model_raw_responses ?? null,
      consensusSteps,
      finalResult: input.result ?? null,
      error: input.error,
      durationMs: input.durationMs,
    };

    setEntries((prev) => [entry, ...prev]);
  }, []);

  const clearLog = useCallback(() => setEntries([]), []);

  const value = useMemo(
    () => ({
      entries,
      panelOpen,
      openPanel: () => setPanelOpen(true),
      closePanel: () => setPanelOpen(false),
      togglePanel: () => setPanelOpen((v) => !v),
      clearLog,
      appendRun,
    }),
    [entries, panelOpen, clearLog, appendRun],
  );

  return (
    <ScoringDebugContext.Provider value={value}>
      {children}
    </ScoringDebugContext.Provider>
  );
}

export function useScoringDebug(): ScoringDebugContextValue {
  const ctx = useContext(ScoringDebugContext);
  if (!ctx) {
    throw new Error("useScoringDebug must be used within ScoringDebugProvider");
  }
  return ctx;
}
