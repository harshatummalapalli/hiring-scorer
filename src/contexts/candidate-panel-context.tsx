"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { CandidateSlidePanel } from "@/components/candidates/candidate-slide-panel";
import type { RoleBrief } from "@/types/role-brief";

export type OpenCandidatePanelOptions = {
  /** When opened from a job workspace, prefer scores for this role. */
  contextJobId?: string | null;
  roleBrief?: RoleBrief | null;
};

type CandidatePanelContextValue = {
  candidateId: string | null;
  contextJobId: string | null;
  roleBrief: RoleBrief | null;
  panelKey: number;
  openPanel: (candidateId: string, options?: OpenCandidatePanelOptions) => void;
  closePanel: () => void;
  refreshPanel: () => void;
};

const CandidatePanelContext = createContext<CandidatePanelContextValue | null>(
  null,
);

export function CandidatePanelProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [contextJobId, setContextJobId] = useState<string | null>(null);
  const [roleBrief, setRoleBrief] = useState<RoleBrief | null>(null);
  const [panelKey, setPanelKey] = useState(0);

  const openPanel = useCallback(
    (id: string, options?: OpenCandidatePanelOptions) => {
      setCandidateId(id);
      setContextJobId(options?.contextJobId ?? null);
      setRoleBrief(options?.roleBrief ?? null);
    },
    [],
  );

  const closePanel = useCallback(() => {
    setCandidateId(null);
    setContextJobId(null);
    setRoleBrief(null);
  }, []);

  const refreshPanel = useCallback(() => {
    setPanelKey((k) => k + 1);
  }, []);

  const value = useMemo(
    () => ({
      candidateId,
      contextJobId,
      roleBrief,
      panelKey,
      openPanel,
      closePanel,
      refreshPanel,
    }),
    [
      candidateId,
      contextJobId,
      roleBrief,
      panelKey,
      openPanel,
      closePanel,
      refreshPanel,
    ],
  );

  return (
    <CandidatePanelContext.Provider value={value}>
      {children}
      <CandidateSlidePanel
        key={`${candidateId ?? ""}-${panelKey}`}
        candidateId={candidateId}
        contextJobId={contextJobId}
        roleBrief={roleBrief}
        onClose={closePanel}
        onScored={refreshPanel}
      />
    </CandidatePanelContext.Provider>
  );
}

export function useCandidatePanel() {
  const context = useContext(CandidatePanelContext);
  if (!context) {
    throw new Error(
      "useCandidatePanel must be used within CandidatePanelProvider",
    );
  }
  return context;
}
