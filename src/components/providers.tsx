"use client";

import { ActiveRoleBriefProvider } from "@/contexts/active-role-brief-context";
import { CandidatePanelProvider } from "@/contexts/candidate-panel-context";
import { ToastProvider } from "@/components/ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ActiveRoleBriefProvider>
        <CandidatePanelProvider>{children}</CandidatePanelProvider>
      </ActiveRoleBriefProvider>
    </ToastProvider>
  );
}
