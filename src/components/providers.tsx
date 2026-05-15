"use client";

import { ActiveRoleBriefProvider } from "@/contexts/active-role-brief-context";
import { ScoringDebugProvider } from "@/contexts/scoring-debug-context";
import { ScoringDebugPanel } from "@/components/scoring-debug/scoring-debug-panel";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ActiveRoleBriefProvider>
      <ScoringDebugProvider>
        {children}
        <ScoringDebugPanel />
      </ScoringDebugProvider>
    </ActiveRoleBriefProvider>
  );
}
