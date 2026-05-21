"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { karta } from "@/lib/brand/karta";

type ScoreHistoryEntry = {
  roleName: string;
  score: number;
  createdAt: string;
};

function formatHistoryDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function normalizeEntries(raw: unknown): ScoreHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: ScoreHistoryEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const createdAt =
      (row.created_at as string | undefined) ??
      (row.createdAt as string | undefined);
    const scoreRaw =
      row.overall_score ?? row.score ?? row.overallScore;
    const roleName =
      (row.role_brief_title as string | undefined) ??
      (row.roleName as string | undefined) ??
      (row.role_name as string | undefined);
    if (createdAt == null || scoreRaw == null) continue;
    const score = Number(scoreRaw);
    if (!Number.isFinite(score)) continue;
    entries.push({
      roleName: roleName?.trim() || "Role",
      score: Math.round(score),
      createdAt: String(createdAt),
    });
  }
  return entries;
}

async function fetchScoreHistory(
  candidateId: string,
): Promise<ScoreHistoryEntry[]> {
  try {
    const res = await fetch(`/api/candidates/${candidateId}/score-history`);
    if (res.ok) {
      const json = (await res.json()) as Record<string, unknown>;
      const list =
        json.history ?? json.scores ?? (Array.isArray(json) ? json : null);
      if (list) return normalizeEntries(list);
    }
  } catch {
    /* fall through to Supabase */
  }

  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("saved_scores")
    .select("overall_score, role_brief_title, created_at")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });

  if (error || !data?.length) return [];
  return normalizeEntries(data);
}

export function CandidateScoreHistory({
  candidateId,
}: {
  candidateId: string;
}) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<ScoreHistoryEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntries(null);
    setOpen(false);
    void (async () => {
      const rows = await fetchScoreHistory(candidateId);
      if (!cancelled) setEntries(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  if (!entries?.length) return null;

  return (
    <section className={`${karta.card} p-4`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-[#64748B]" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-[#64748B]" />
        )}
        <h3 className={karta.sectionHeading}>Score History</h3>
      </button>
      {open && (
        <ul className="mt-3 space-y-2 border-t border-[#F1F5F9] pt-3">
          {entries.map((entry, i) => (
            <li
              key={`${entry.createdAt}-${entry.roleName}-${i}`}
              className="flex items-baseline justify-between gap-3 text-sm"
            >
              <span className="font-medium text-[#1E293B]">{entry.roleName}</span>
              <span className="shrink-0 text-[#64748B]">
                <span className="font-semibold text-[#0D9488]">
                  {entry.score}
                </span>
                <span className="text-[#94A3B8]"> / 100</span>
                <span className="mx-1.5 text-[#CBD5E1]">·</span>
                {formatHistoryDate(entry.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
