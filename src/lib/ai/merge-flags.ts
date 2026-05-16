import { MODEL_ROLE_DISPLAY } from "@/lib/scoring/recruiter-labels";
import type { AttributedFlag, ModelRole } from "@/types/score";

const SOURCE_SHORT: Record<ModelRole, string> = MODEL_ROLE_DISPLAY;

export const MAX_GREEN_FLAGS = 3;
export const MAX_WATCH_SIGNALS = 4;
export const MAX_GPT_RISKS = 3;
export const MAX_GPT_GAPS = 2;
export const MAX_CLAUDE_WATCH = 3;

export type FlagEntry = { text: string; source: ModelRole };

function normalizeFlagText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantWords(text: string): Set<string> {
  return new Set(
    normalizeFlagText(text)
      .split(" ")
      .filter((w) => w.length > 3),
  );
}

/** True when two flag texts describe the same concern or strength. */
export function flagTextsAreDuplicate(a: string, b: string): boolean {
  const na = normalizeFlagText(a);
  const nb = normalizeFlagText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length > nb.length ? na : nb;
  if (shorter.length >= 12 && longer.includes(shorter)) return true;

  const wordsA = significantWords(a);
  const wordsB = significantWords(b);
  if (wordsA.size === 0 || wordsB.size === 0) return false;

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  return overlap / union >= 0.5;
}

export function formatSourceLabel(sources: ModelRole[]): string {
  const unique = [...new Set(sources)];
  return unique.map((s) => SOURCE_SHORT[s]).join(" · ");
}

export function mergeAttributedFlags(
  entries: FlagEntry[],
  max: number,
): AttributedFlag[] {
  const merged: AttributedFlag[] = [];

  for (const { text, source } of entries) {
    const trimmed = text.trim();
    if (!trimmed) continue;

    const existing = merged.find((f) => flagTextsAreDuplicate(f.text, trimmed));
    if (existing) {
      if (!existing.sources.includes(source)) {
        existing.sources.push(source);
        existing.sourceLabel = formatSourceLabel(existing.sources);
      }
      continue;
    }

    if (merged.length >= max) continue;

    merged.push({
      text: trimmed,
      sources: [source],
      sourceLabel: formatSourceLabel([source]),
    });
  }

  return merged;
}

/** Normalize flags loaded from DB (legacy single-source shape). */
export function normalizeAttributedFlag(
  flag: AttributedFlag | { text: string; source?: ModelRole; sources?: ModelRole[]; sourceLabel?: string },
): AttributedFlag {
  if ("sources" in flag && Array.isArray(flag.sources) && flag.sources.length > 0) {
    return {
      text: flag.text,
      sources: flag.sources,
      sourceLabel: flag.sourceLabel ?? formatSourceLabel(flag.sources),
    };
  }
  const source = "source" in flag && flag.source ? flag.source : "claude";
  return {
    text: flag.text,
    sources: [source],
    sourceLabel: flag.sourceLabel ?? formatSourceLabel([source]),
  };
}
