import type { CoreSignal, RoleBriefAnalysis } from "@/types/role-brief";

/**
 * Remove skills whose name is a substring of another (case-insensitive).
 * Keeps the longer, more specific name (e.g. "Microservices Architecture" over "Microservices").
 */
export function dedupeSkillNames(skills: string[]): string[] {
  const byKey = new Map<string, string>();
  for (const raw of skills) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    const existing = byKey.get(key);
    if (!existing || trimmed.length > existing.length) {
      byKey.set(key, trimmed);
    }
  }

  const unique = [...byKey.values()].sort((a, b) => b.length - a.length);
  const kept: string[] = [];

  for (const skill of unique) {
    const lower = skill.toLowerCase();
    const dominated = kept.some((k) => {
      const kLower = k.toLowerCase();
      return kLower.includes(lower) && k.length > lower.length;
    });
    if (!dominated) kept.push(skill);
  }

  return kept;
}

function mergeEquivalentsForSkill(
  skill: string,
  signals: CoreSignal[],
): string[] {
  const target = skill.toLowerCase();
  const eq = new Set<string>();
  for (const s of signals) {
    const sl = s.skill.trim().toLowerCase();
    if (sl === target || skill.toLowerCase().includes(sl) || sl.includes(target)) {
      for (const e of s.equivalents) {
        const t = e.trim();
        if (t && t.toLowerCase() !== target) eq.add(t);
      }
    }
  }
  return [...eq];
}

function dedupeCoreSignals(signals: CoreSignal[]): CoreSignal[] {
  const keptNames = dedupeSkillNames(signals.map((s) => s.skill));
  return keptNames.map((skill) => ({
    skill,
    equivalents: mergeEquivalentsForSkill(skill, signals),
  }));
}

function dedupeSemanticClusters(
  clusters: Record<string, string[]>,
): Record<string, string[]> {
  const keptKeys = dedupeSkillNames(Object.keys(clusters));
  const out: Record<string, string[]> = {};

  for (const keptKey of keptKeys) {
    const keptLower = keptKey.toLowerCase();
    const merged = new Set<string>();
    for (const [key, values] of Object.entries(clusters)) {
      const keyLower = key.trim().toLowerCase();
      if (!keyLower) continue;
      if (
        keyLower === keptLower ||
        keptLower.includes(keyLower) ||
        keyLower.includes(keptLower)
      ) {
        for (const v of values) {
          const t = v.trim();
          if (t) merged.add(t);
        }
      }
    }
    out[keptKey] = [...merged];
  }

  return out;
}

/** Deduplicate overlapping skills across JD analysis fields before save. */
export function dedupeRoleBriefAnalysis(
  analysis: RoleBriefAnalysis,
): RoleBriefAnalysis {
  return {
    ...analysis,
    deal_breakers: dedupeSkillNames(analysis.deal_breakers),
    preferred_signals: dedupeSkillNames(analysis.preferred_signals),
    core_signals: dedupeCoreSignals(analysis.core_signals),
    semantic_clusters: dedupeSemanticClusters(analysis.semantic_clusters),
  };
}
