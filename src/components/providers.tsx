"use client";

import { ActiveRoleBriefProvider } from "@/contexts/active-role-brief-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ActiveRoleBriefProvider>{children}</ActiveRoleBriefProvider>;
}
