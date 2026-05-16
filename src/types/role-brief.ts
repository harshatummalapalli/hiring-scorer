export type TitleBand = "Entry" | "Mid" | "Senior" | "Staff" | "Principal";

export const TITLE_BANDS: TitleBand[] = [
  "Entry",
  "Mid",
  "Senior",
  "Staff",
  "Principal",
];

export type CoreSignal = {
  skill: string;
  equivalents: string[];
};

export type RoleBriefAnalysis = {
  deal_breakers: string[];
  core_signals: CoreSignal[];
  preferred_signals: string[];
  cannot_assess: string[];
  equivalent_titles: string[];
  title_band: TitleBand;
  semantic_clusters: Record<string, string[]>;
};

export type RoleBrief = {
  id: string;
  title: string;
  job_description: string | null;
  deal_breakers: string[];
  core_signals: CoreSignal[];
  preferred_signals: string[];
  cannot_assess: string[];
  equivalent_titles: string[];
  title_band: TitleBand | null;
  semantic_clusters: Record<string, string[]>;
  weight_skills: number;
  weight_trajectory: number;
  weight_domain: number;
  weight_seniority: number;
  weight_tenure: number;
  created_at: string;
};

export const DEFAULT_SCORING_WEIGHTS = {
  weight_skills: 5,
  weight_trajectory: 5,
  weight_domain: 5,
  weight_seniority: 5,
  weight_tenure: 5,
} as const;

export type StringCategoryId =
  | "deal_breakers"
  | "preferred_signals"
  | "cannot_assess"
  | "equivalent_titles";

export const STRING_CATEGORIES: {
  id: StringCategoryId;
  label: string;
  description: string;
}[] = [
  {
    id: "deal_breakers",
    label: "Deal breakers",
    description: "Must-haves — absence disqualifies the candidate",
  },
  {
    id: "preferred_signals",
    label: "Preferred signals",
    description: "Nice to have — boosts score but absence is not penalised",
  },
  {
    id: "cannot_assess",
    label: "Cannot assess from resume",
    description: "Soft skills or qualities not visible on a CV alone",
  },
  {
    id: "equivalent_titles",
    label: "Equivalent titles",
    description: "Job titles considered a match for this role",
  },
];

export function emptyAnalysis(): RoleBriefAnalysis {
  return {
    deal_breakers: [],
    core_signals: [],
    preferred_signals: [],
    cannot_assess: [],
    equivalent_titles: [],
    title_band: "Mid",
    semantic_clusters: {},
  };
}

export function deriveTitleFromAnalysis(
  analysis: RoleBriefAnalysis,
  jobDescription: string,
): string {
  const fromEquiv = analysis.equivalent_titles.find((t) => t.trim());
  if (fromEquiv) return fromEquiv.trim();

  const line = jobDescription
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 2 && l.length < 120);
  if (line) return line.replace(/^#+\s*/, "");

  return "Role brief";
}

export function analysisFromRoleBrief(brief: RoleBrief): RoleBriefAnalysis {
  return {
    deal_breakers: brief.deal_breakers ?? [],
    core_signals: brief.core_signals ?? [],
    preferred_signals: brief.preferred_signals ?? [],
    cannot_assess: brief.cannot_assess ?? [],
    equivalent_titles: brief.equivalent_titles ?? [],
    title_band: brief.title_band ?? "Mid",
    semantic_clusters: brief.semantic_clusters ?? {},
  };
}

export function roleBriefToSavePayload(
  title: string,
  jobDescription: string,
  analysis: RoleBriefAnalysis,
) {
  return {
    title: title.trim(),
    job_description: jobDescription.trim(),
    deal_breakers: analysis.deal_breakers,
    core_signals: analysis.core_signals,
    preferred_signals: analysis.preferred_signals,
    cannot_assess: analysis.cannot_assess,
    equivalent_titles: analysis.equivalent_titles,
    title_band: analysis.title_band,
    semantic_clusters: analysis.semantic_clusters,
    department: null,
    responsibilities: null,
    required_skills: null,
    nice_to_have_skills: null,
    experience_years: null,
    ...DEFAULT_SCORING_WEIGHTS,
  };
}

function parseJsonArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter(Boolean);
}

function parseCoreSignals(value: unknown): CoreSignal[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item !== "object" || item == null) return null;
      const o = item as Record<string, unknown>;
      const skill = String(o.skill ?? o.name ?? "").trim();
      if (!skill) return null;
      const equivalents = parseJsonArray(o.equivalents);
      return { skill, equivalents };
    })
    .filter((x): x is CoreSignal => x != null);
}

function parseSemanticClusters(value: unknown): Record<string, string[]> {
  if (typeof value !== "object" || value == null || Array.isArray(value)) {
    return {};
  }
  const out: Record<string, string[]> = {};
  for (const [key, val] of Object.entries(value)) {
    const k = key.trim();
    if (!k) continue;
    out[k] = parseJsonArray(val);
  }
  return out;
}

function parseTitleBand(value: unknown): TitleBand | null {
  const v = String(value ?? "").trim();
  if ((TITLE_BANDS as string[]).includes(v)) return v as TitleBand;
  return null;
}

/** Map Supabase row (new or legacy) to RoleBrief. */
export function parseRoleBriefRow(row: Record<string, unknown>): RoleBrief {
  const legacyRequired = row.required_skills
    ? String(row.required_skills)
    : "";
  const legacyNice = row.nice_to_have_skills
    ? String(row.nice_to_have_skills)
    : "";

  let deal_breakers = parseJsonArray(row.deal_breakers);
  let core_signals = parseCoreSignals(row.core_signals);
  let preferred_signals = parseJsonArray(row.preferred_signals);

  if (deal_breakers.length === 0 && legacyRequired) {
    deal_breakers = legacyRequired
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (preferred_signals.length === 0 && legacyNice) {
    preferred_signals = legacyNice
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (core_signals.length === 0 && legacyRequired) {
    core_signals = legacyRequired
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((skill) => ({ skill, equivalents: [] }));
  }

  const clamp = (n: unknown, fallback: number) => {
    const v = Number(n);
    if (Number.isNaN(v)) return fallback;
    return Math.max(1, Math.min(10, Math.round(v)));
  };

  return {
    id: String(row.id),
    title: String(row.title ?? "Role brief"),
    job_description: row.job_description
      ? String(row.job_description)
      : [row.responsibilities, row.required_skills]
          .filter(Boolean)
          .map(String)
          .join("\n\n") || null,
    deal_breakers,
    core_signals,
    preferred_signals,
    cannot_assess: parseJsonArray(row.cannot_assess),
    equivalent_titles: parseJsonArray(row.equivalent_titles),
    title_band: parseTitleBand(row.title_band),
    semantic_clusters: parseSemanticClusters(row.semantic_clusters),
    weight_skills: clamp(row.weight_skills, 5),
    weight_trajectory: clamp(row.weight_trajectory, 5),
    weight_domain: clamp(row.weight_domain, 5),
    weight_seniority: clamp(row.weight_seniority, 5),
    weight_tenure: clamp(row.weight_tenure, 5),
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}
