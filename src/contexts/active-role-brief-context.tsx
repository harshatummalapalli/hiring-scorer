"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { RoleBrief } from "@/types/role-brief";

const STORAGE_KEY = "hiring_scorer_active_role_brief_id";

type ActiveRoleBriefContextValue = {
  activeBriefId: string | null;
  activeBriefTitle: string | null;
  hydrated: boolean;
  setActiveBrief: (brief: RoleBrief | null) => void;
  syncActiveBriefFromList: (briefs: RoleBrief[]) => void;
};

const ActiveRoleBriefContext =
  createContext<ActiveRoleBriefContextValue | null>(null);

export function ActiveRoleBriefProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeBriefId, setActiveBriefId] = useState<string | null>(null);
  const [activeBriefTitle, setActiveBriefTitle] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setActiveBriefId(stored);
    }
    setHydrated(true);
  }, []);

  const setActiveBrief = useCallback((brief: RoleBrief | null) => {
    if (brief) {
      localStorage.setItem(STORAGE_KEY, brief.id);
      setActiveBriefId(brief.id);
      setActiveBriefTitle(brief.title);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      setActiveBriefId(null);
      setActiveBriefTitle(null);
    }
  }, []);

  const syncActiveBriefFromList = useCallback((briefs: RoleBrief[]) => {
    const storedId = localStorage.getItem(STORAGE_KEY);
    if (!storedId) return;

    const match = briefs.find((b) => b.id === storedId);
    if (match) {
      setActiveBriefId(match.id);
      setActiveBriefTitle(match.title);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      setActiveBriefId(null);
      setActiveBriefTitle(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      activeBriefId,
      activeBriefTitle,
      hydrated,
      setActiveBrief,
      syncActiveBriefFromList,
    }),
    [
      activeBriefId,
      activeBriefTitle,
      hydrated,
      setActiveBrief,
      syncActiveBriefFromList,
    ],
  );

  return (
    <ActiveRoleBriefContext.Provider value={value}>
      {children}
    </ActiveRoleBriefContext.Provider>
  );
}

export function useActiveRoleBrief() {
  const context = useContext(ActiveRoleBriefContext);
  if (!context) {
    throw new Error(
      "useActiveRoleBrief must be used within ActiveRoleBriefProvider",
    );
  }
  return context;
}
