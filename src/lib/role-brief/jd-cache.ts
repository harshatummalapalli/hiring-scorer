import { createHash } from "crypto";
import type { CoreSignal, TitleBand } from "@/types/role-brief";
import type { RoleBrief } from "@/types/role-brief";

const SIMILARITY_REUSE_THRESHOLD = 80;

export type JdAnalysisCacheSource = {
  job_description: string | null;
  deal_breakers: string[];
  core_signals: CoreSignal[];
  preferred_signals: string[];
  semantic_clusters: Record<string, string[]>;
};

function tokenizeWords(text: string): string[] {
  return (text.toLowerCase().match(/\b[a-z0-9]+\b/g) ?? []).filter(Boolean);
}

/** Character count + word count fingerprint for quick equality checks. */
export function computeJobDescriptionHash(jobDescription: string): string {
  const trimmed = jobDescription.trim();
  const wordCount = tokenizeWords(trimmed).length;
  return `${trimmed.length}_${wordCount}`;
}

/**
 * Percentage of words in `newText` that also appear in `storedText`.
 * Returns 0–100.
 */
export function jdWordOverlapPercent(newText: string, storedText: string): number {
  const newWords = tokenizeWords(newText);
  if (newWords.length === 0) return 0;
  const storedSet = new Set(tokenizeWords(storedText));
  const matches = newWords.filter((w) => storedSet.has(w)).length;
  return (matches / newWords.length) * 100;
}

export function isAnalysisPopulated(source: JdAnalysisCacheSource): boolean {
  return (
    Boolean(source.job_description?.trim()) &&
    source.deal_breakers.length > 0 &&
    source.core_signals.length > 0 &&
    source.preferred_signals.length > 0 &&
    Object.keys(source.semantic_clusters).length > 0
  );
}

/**
 * Hash of deal_breakers + core_signals — what drives AI scoring content.
 * Weight-only changes do not change this hash.
 */
export function computeBriefContentHash(
  brief: Pick<RoleBrief, "deal_breakers" | "core_signals">,
): string {
  const dealBreakers = [...(brief.deal_breakers ?? [])].sort().join("|");
  const coreSignals = [...(brief.core_signals ?? [])]
    .map((s) => s.skill.toLowerCase().trim())
    .sort()
    .join("|");
  const content = `${dealBreakers}::${coreSignals}`;
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export function shouldReuseCachedJdAnalysis(
  newJobDescription: string,
  storedJobDescription: string,
): boolean {
  const stored = storedJobDescription.trim();
  const next = newJobDescription.trim();
  if (!stored || !next) return false;

  if (computeJobDescriptionHash(next) === computeJobDescriptionHash(stored)) {
    return true;
  }

  return jdWordOverlapPercent(next, stored) > SIMILARITY_REUSE_THRESHOLD;
}
