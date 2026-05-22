import { applyLinkPath, generateApplicationToken } from "@/lib/jobs/token";
import { computeJobDescriptionHash } from "@/lib/role-brief/jd-cache";
import { dedupeRoleBriefAnalysis } from "@/lib/role-brief/dedupe-skills";
import {
  jobPostingToBriefColumns,
  type JobPostingFields,
} from "@/types/job-posting";
import {
  parseAutoScoreMode,
  parseJobStatus,
  type AutoScoreMode,
  type JobStatus,
} from "@/types/job";

export type TitleBand =
  | "Intern"
  | "Entry"
  | "Mid"
  | "Senior"
  | "Lead"
  | "Staff"
  | "Principal"
  | "Manager"
  | "Senior Manager"
  | "Director"
  | "Senior Director"
  | "VP"
  | "C-Suite";

export const TITLE_BANDS: TitleBand[] = [
  "Intern",
  "Entry",
  "Mid",
  "Senior",
  "Lead",
  "Staff",
  "Principal",
  "Manager",
  "Senior Manager",
  "Director",
  "Senior Director",
  "VP",
  "C-Suite",
];

export type CoreSignal = {
  skill: string;
  equivalents: string[];
};

export type RoleBriefSuggestedWeights = {
  weight_skills: number;
  weight_trajectory: number;
  weight_domain: number;
  weight_seniority: number;
  weight_tenure: number;
};

export type RoleBriefAnalysis = {
  deal_breakers: string[];
  core_signals: CoreSignal[];
  preferred_signals: string[];
  cannot_assess: string[];
  equivalent_titles: string[];
  title_band: TitleBand;
  semantic_clusters: Record<string, string[]>;
  suggested_weights?: RoleBriefSuggestedWeights;
};

export type RoleBrief = {
  id: string;
  title: string;
  job_location: string | null;
  seniority_override: string | null;
  department: string | null;
  client_company_name: string | null;
  client_company_brief: string | null;
  client_company_size: string | null;
  client_company_website: string | null;
  job_description: string | null;
  job_description_hash: string | null;
  analysis_version: number;
  last_analysed_at: string | null;
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
  application_token: string | null;
  apply_link: string | null;
  company_name: string | null;
  application_active: boolean;
  application_count: number;
  auto_score_mode: AutoScoreMode;
  status: JobStatus;
  share_token: string | null;
  share_enabled: boolean;
  created_by: string | null;
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
    label: "Must Haves",
    description: "Required — absence disqualifies the candidate",
  },
  {
    id: "preferred_signals",
    label: "Nice to Haves",
    description: "Optional — boosts match but absence is not penalised",
  },
  {
    id: "cannot_assess",
    label: "Assess in Interview",
    description: "Qualities to explore in conversation, not on a CV alone",
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

  return "Job role";
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

function clampWeight(n: unknown, fallback: number): number {
  const v = Number(n);
  if (Number.isNaN(v)) return fallback;
  return Math.max(1, Math.min(10, Math.round(v)));
}

function weightsFromAnalysis(
  analysis: RoleBriefAnalysis,
): RoleBriefSuggestedWeights {
  const w = analysis.suggested_weights;
  return {
    weight_skills: clampWeight(w?.weight_skills, DEFAULT_SCORING_WEIGHTS.weight_skills),
    weight_trajectory: clampWeight(
      w?.weight_trajectory,
      DEFAULT_SCORING_WEIGHTS.weight_trajectory,
    ),
    weight_domain: clampWeight(w?.weight_domain, DEFAULT_SCORING_WEIGHTS.weight_domain),
    weight_seniority: clampWeight(
      w?.weight_seniority,
      DEFAULT_SCORING_WEIGHTS.weight_seniority,
    ),
    weight_tenure: clampWeight(w?.weight_tenure, DEFAULT_SCORING_WEIGHTS.weight_tenure),
  };
}

export function jobInsertDefaults() {
  const token = generateApplicationToken();
  return {
    application_token: token,
    apply_link: applyLinkPath(token),
    company_name: null,
    application_active: true,
    application_count: 0,
    auto_score_mode: "needs_scoring" as AutoScoreMode,
    status: "active" as JobStatus,
  };
}

export type RoleBriefAnalysisMeta = {
  job_description_hash?: string | null;
  analysis_version?: number;
  last_analysed_at?: string | null;
};

export function roleBriefToSavePayload(
  title: string,
  jobDescription: string,
  analysis: RoleBriefAnalysis,
  options?: {
    isNew?: boolean;
    analysisMeta?: RoleBriefAnalysisMeta;
    jobPosting?: JobPostingFields;
  },
) {
  const deduped = dedupeRoleBriefAnalysis(analysis);
  const weights = weightsFromAnalysis({ ...deduped, suggested_weights: analysis.suggested_weights });

  const jd = jobDescription.trim();
  const postingColumns = options?.jobPosting
    ? jobPostingToBriefColumns(options.jobPosting)
    : { title: title.trim(), department: null };

  return {
    ...postingColumns,
    title: options?.jobPosting?.jobTitle.trim() ?? title.trim(),
    job_description: jd,
    job_description_hash:
      options?.analysisMeta?.job_description_hash ??
      computeJobDescriptionHash(jd),
    analysis_version: options?.analysisMeta?.analysis_version ?? 1,
    last_analysed_at: options?.analysisMeta?.last_analysed_at ?? null,
    deal_breakers: deduped.deal_breakers,
    core_signals: deduped.core_signals,
    preferred_signals: deduped.preferred_signals,
    cannot_assess: deduped.cannot_assess,
    equivalent_titles: deduped.equivalent_titles,
    title_band: deduped.title_band,
    semantic_clusters: deduped.semantic_clusters,
    responsibilities: null,
    required_skills: null,
    nice_to_have_skills: null,
    experience_years: null,
    ...weights,
    ...(options?.isNew ? jobInsertDefaults() : {}),
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
    title: String(row.title ?? "Job role"),
    job_location: row.job_location != null ? String(row.job_location) : null,
    seniority_override:
      row.seniority_override != null ? String(row.seniority_override) : null,
    department: row.department != null ? String(row.department) : null,
    client_company_name:
      row.client_company_name != null ? String(row.client_company_name) : null,
    client_company_brief:
      row.client_company_brief != null
        ? String(row.client_company_brief)
        : null,
    client_company_size:
      row.client_company_size != null ? String(row.client_company_size) : null,
    client_company_website:
      row.client_company_website != null
        ? String(row.client_company_website)
        : null,
    job_description: row.job_description
      ? String(row.job_description)
      : [row.responsibilities, row.required_skills]
          .filter(Boolean)
          .map(String)
          .join("\n\n") || null,
    job_description_hash:
      row.job_description_hash != null
        ? String(row.job_description_hash)
        : null,
    analysis_version: clampWeight(row.analysis_version, 1),
    last_analysed_at:
      row.last_analysed_at != null ? String(row.last_analysed_at) : null,
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
    application_token:
      row.application_token != null ? String(row.application_token) : null,
    apply_link: row.apply_link != null ? String(row.apply_link) : null,
    company_name: row.company_name != null ? String(row.company_name) : null,
    application_active: row.application_active !== false,
    application_count: Math.max(0, Number(row.application_count ?? 0) || 0),
    auto_score_mode: parseAutoScoreMode(row.auto_score_mode),
    status: parseJobStatus(row.status),
    share_token: row.share_token != null ? String(row.share_token) : null,
    share_enabled: row.share_enabled === true,
    created_by: row.created_by != null ? String(row.created_by) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}
