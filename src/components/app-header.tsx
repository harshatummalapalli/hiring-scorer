"use client";

import Link from "next/link";
import { Briefcase, Bug } from "lucide-react";
import { useActiveRoleBrief } from "@/contexts/active-role-brief-context";
import { useScoringDebug } from "@/contexts/scoring-debug-context";

export function AppHeader() {
  const { activeBriefTitle } = useActiveRoleBrief();
  const { togglePanel, entries, panelOpen } = useScoringDebug();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/role-briefs"
            className="flex shrink-0 items-center gap-2 text-slate-900"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Briefcase className="h-4 w-4" aria-hidden />
            </span>
            <span className="hidden font-semibold tracking-tight sm:inline">
              Hiring Scorer
            </span>
          </Link>
          <span className="hidden text-slate-300 sm:inline" aria-hidden>
            |
          </span>
          <p className="truncate text-sm text-slate-600">
            {activeBriefTitle ? (
              <>
                <span className="font-medium text-slate-900">Active role:</span>{" "}
                {activeBriefTitle}
              </>
            ) : (
              <span className="text-slate-500">No active role brief selected</span>
            )}
          </p>
        </div>
        <nav className="flex shrink-0 items-center gap-1 text-sm">
          <Link
            href="/role-briefs"
            className="rounded-md px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Role Briefs
          </Link>
          <Link
            href="/candidates"
            className="rounded-md px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Candidates
          </Link>
          <Link
            href="/pipeline"
            className="rounded-md px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Pipeline
          </Link>
          <Link
            href="/analysis"
            className="rounded-md px-3 py-1.5 font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Analysis
          </Link>
          <button
            type="button"
            onClick={togglePanel}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
              panelOpen
                ? "bg-slate-900 text-white"
                : "text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
            }`}
            title="Scoring debug log (session only)"
          >
            <Bug className="h-3.5 w-3.5" aria-hidden />
            Debug
            {entries.length > 0 && (
              <span
                className={`min-w-[1.25rem] rounded-full px-1 py-0.5 text-center text-[10px] font-semibold ${
                  panelOpen ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {entries.length}
              </span>
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}
