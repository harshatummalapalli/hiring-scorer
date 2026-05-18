"use client";

import { ActiveRoleBriefProvider } from "@/contexts/active-role-brief-context";
import { CandidatePanelProvider } from "@/contexts/candidate-panel-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ActiveRoleBriefProvider>
      <CandidatePanelProvider>{children}</CandidatePanelProvider>
    </ActiveRoleBriefProvider>
  );
}
