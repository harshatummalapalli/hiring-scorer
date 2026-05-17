import type { RoleBrief } from "@/types/role-brief";

export type SkillMatchType = "direct" | "semantic" | "not_found";

export type SkillMatchResult = {
  skill: string;
  match_type: SkillMatchType;
  matched_term: string | null;
  context_quote: string | null;
};

export type SkillsIntelligence = {
  matches: SkillMatchResult[];
  total_required: number;
  matched_count: number;
  direct_count: number;
  semantic_count: number;
};

const MAX_CONTEXT_LEN = 100;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isAlphanumericSkill(term: string): boolean {
  return /^[\w\s.+#/-]+$/.test(term) && !/^[.+#-]/.test(term);
}

function hasWordBoundary(text: string, start: number, length: number): boolean {
  const before = start > 0 ? text[start - 1] : " ";
  const after =
    start + length < text.length ? text[start + length] : " ";
  const boundary = /[\s,;:|/()[\]{}<>]/.test(before) && /[\s,;:|/()[\]{}<>]/.test(after);
  return boundary || start === 0;
}

function findTermInResume(
  term: string,
  resumeText: string,
): { index: number; matched_term: string } | null {
  const needle = term.trim();
  if (!needle || needle.length < 2) return null;

  const lowerResume = resumeText.toLowerCase();
  const lowerNeedle = needle.toLowerCase();

  if (isAlphanumericSkill(needle)) {
    const pattern = new RegExp(`\\b${escapeRegex(needle)}\\b`, "i");
    const match = pattern.exec(resumeText);
    if (match?.index != null) {
      return { index: match.index, matched_term: match[0] };
    }
  }

  let from = 0;
  while (from < lowerResume.length) {
    const index = lowerResume.indexOf(lowerNeedle, from);
    if (index === -1) break;
    if (hasWordBoundary(resumeText, index, needle.length)) {
      return {
        index,
        matched_term: resumeText.slice(index, index + needle.length),
      };
    }
    from = index + 1;
  }

  return null;
}

function extractContextQuote(
  resumeText: string,
  index: number,
  matchedLength: number,
): string {
  const target = Math.min(MAX_CONTEXT_LEN, resumeText.length);
  const matchEnd = index + matchedLength;
  let start = index;
  let end = matchEnd;

  while (end - start < target && (start > 0 || end < resumeText.length)) {
    if (start > 0 && end - start < target) start -= 1;
    if (end < resumeText.length && end - start < target) end += 1;
  }

  let quote = resumeText.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) quote = `…${quote}`;
  if (end < resumeText.length) quote = `${quote}…`;
  if (quote.length > MAX_CONTEXT_LEN) {
    quote = `${quote.slice(0, MAX_CONTEXT_LEN - 1).trim()}…`;
  }
  return quote;
}

export type RequiredSkillSpec = {
  skill: string;
  equivalents: string[];
};

/** Collect required skills and equivalents from role brief semantic clusters and core signals. */
export function collectRequiredSkills(roleBrief: RoleBrief): RequiredSkillSpec[] {
  const bySkill = new Map<string, Set<string>>();

  for (const [rawSkill, cluster] of Object.entries(
    roleBrief.semantic_clusters ?? {},
  )) {
    const skill = rawSkill.trim();
    if (!skill) continue;
    const set = bySkill.get(skill) ?? new Set<string>();
    for (const tech of cluster) {
      const t = tech.trim();
      if (t && t.toLowerCase() !== skill.toLowerCase()) set.add(t);
    }
    bySkill.set(skill, set);
  }

  for (const signal of roleBrief.core_signals ?? []) {
    const skill = signal.skill.trim();
    if (!skill) continue;
    const set = bySkill.get(skill) ?? new Set<string>();
    for (const eq of signal.equivalents ?? []) {
      const t = eq.trim();
      if (t && t.toLowerCase() !== skill.toLowerCase()) set.add(t);
    }
    bySkill.set(skill, set);
  }

  if (bySkill.size === 0 && (roleBrief.deal_breakers?.length ?? 0) > 0) {
    for (const item of roleBrief.deal_breakers) {
      const skill = item.trim();
      if (skill.length >= 2 && skill.length <= 80) {
        bySkill.set(skill, new Set());
      }
    }
  }

  return Array.from(bySkill.entries())
    .map(([skill, equivalents]) => ({
      skill,
      equivalents: Array.from(equivalents),
    }))
    .sort((a, b) => a.skill.localeCompare(b.skill));
}

export function matchSingleSkill(
  skill: string,
  equivalents: string[],
  resumeText: string,
): SkillMatchResult {
  const direct = findTermInResume(skill, resumeText);
  if (direct) {
    return {
      skill,
      match_type: "direct",
      matched_term: direct.matched_term,
      context_quote: extractContextQuote(
        resumeText,
        direct.index,
        direct.matched_term.length,
      ),
    };
  }

  const sortedEquivalents = [...equivalents].sort(
    (a, b) => b.length - a.length,
  );
  for (const equivalent of sortedEquivalents) {
    const hit = findTermInResume(equivalent, resumeText);
    if (hit) {
      return {
        skill,
        match_type: "semantic",
        matched_term: equivalent,
        context_quote: extractContextQuote(
          resumeText,
          hit.index,
          hit.matched_term.length,
        ),
      };
    }
  }

  return {
    skill,
    match_type: "not_found",
    matched_term: null,
    context_quote: null,
  };
}

export function matchRequiredSkills(
  roleBrief: RoleBrief,
  resumeText: string,
): SkillsIntelligence {
  const specs = collectRequiredSkills(roleBrief);
  const trimmedResume = resumeText.trim();

  if (specs.length === 0 || !trimmedResume) {
    return {
      matches: [],
      total_required: 0,
      matched_count: 0,
      direct_count: 0,
      semantic_count: 0,
    };
  }

  const matches = specs.map(({ skill, equivalents }) =>
    matchSingleSkill(skill, equivalents, trimmedResume),
  );

  const direct_count = matches.filter((m) => m.match_type === "direct").length;
  const semantic_count = matches.filter((m) => m.match_type === "semantic").length;

  return {
    matches,
    total_required: matches.length,
    matched_count: direct_count + semantic_count,
    direct_count,
    semantic_count,
  };
}

export function formatSkillsIntelligenceForPrompt(
  intelligence: SkillsIntelligence,
): string {
  if (intelligence.total_required === 0) return "";

  const lines = intelligence.matches.map((m) => {
    if (m.match_type === "direct") {
      return `- ${m.skill}: DIRECT MATCH ("${m.matched_term}")`;
    }
    if (m.match_type === "semantic") {
      return `- ${m.skill}: SEMANTIC MATCH via "${m.matched_term}"`;
    }
    return `- ${m.skill}: NOT FOUND`;
  });

  const summary =
    formatSkillsMatchSummary(intelligence) ??
    `Matched ${intelligence.matched_count} of ${intelligence.total_required} required skills`;

  return `SKILLS INTELLIGENCE (deterministic semantic matching):
${summary}
${lines.join("\n")}`;
}

export function formatSkillsMatchSummary(intelligence: SkillsIntelligence): string | null {
  if (intelligence.total_required === 0) return null;

  const base = `Matched ${intelligence.matched_count} of ${intelligence.total_required} required skills`;
  if (intelligence.semantic_count > 0) {
    const noun = intelligence.semantic_count === 1 ? "inference" : "inferences";
    return `${base} — ${intelligence.semantic_count} through semantic ${noun}`;
  }
  return base;
}
