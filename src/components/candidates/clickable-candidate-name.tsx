"use client";

import {
  useCandidatePanel,
  type OpenCandidatePanelOptions,
} from "@/contexts/candidate-panel-context";

type ClickableCandidateNameProps = {
  candidateId: string;
  children: React.ReactNode;
  className?: string;
  panelOptions?: OpenCandidatePanelOptions;
};

export function ClickableCandidateName({
  candidateId,
  children,
  className = "font-medium text-slate-900 hover:text-[#0D9488] hover:underline text-left",
  panelOptions,
}: ClickableCandidateNameProps) {
  const { openPanel } = useCandidatePanel();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openPanel(candidateId, panelOptions);
      }}
      className={className}
    >
      {children}
    </button>
  );
}
