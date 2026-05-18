export type SkillDomainId =
  | "frontend"
  | "backend"
  | "data_ml"
  | "devops_infra"
  | "ai_llm";

export type SkillDomain = {
  id: SkillDomainId;
  label: string;
  keywords: string[];
};

export const SKILL_DOMAINS: SkillDomain[] = [
  {
    id: "frontend",
    label: "Frontend",
    keywords: [
      "react",
      "vue",
      "angular",
      "typescript",
      "javascript",
      "css",
      "html",
      "next.js",
      "nextjs",
      "svelte",
      "redux",
      "webpack",
      "tailwind",
      "figma",
      "ui",
      "ux",
      "frontend",
      "web development",
    ],
  },
  {
    id: "backend",
    label: "Backend",
    keywords: [
      "python",
      "java",
      "go",
      "golang",
      "rust",
      "node.js",
      "nodejs",
      "fastapi",
      "django",
      "flask",
      "spring",
      "express",
      "postgresql",
      "postgres",
      "mysql",
      "redis",
      "kafka",
      "rabbitmq",
      "api",
      "rest",
      "graphql",
      "microservices",
      "databases",
      "backend",
      "server",
    ],
  },
  {
    id: "data_ml",
    label: "Data and ML",
    keywords: [
      "pytorch",
      "tensorflow",
      "pandas",
      "numpy",
      "spark",
      "hadoop",
      "dbt",
      "airflow",
      "mlflow",
      "jupyter",
      "scikit-learn",
      "sklearn",
      "xgboost",
      "machine learning",
      "data engineering",
      "data science",
      "analytics",
    ],
  },
  {
    id: "devops_infra",
    label: "DevOps and Infra",
    keywords: [
      "kubernetes",
      "k8s",
      "docker",
      "terraform",
      "aws",
      "gcp",
      "azure",
      "ci/cd",
      "cicd",
      "jenkins",
      "github actions",
      "helm",
      "linux",
      "cloud",
      "infrastructure",
      "devops",
      "sre",
    ],
  },
  {
    id: "ai_llm",
    label: "AI and LLM",
    keywords: [
      "langchain",
      "llamaindex",
      "rag",
      "embeddings",
      "vector database",
      "pinecone",
      "weaviate",
      "chromadb",
      "chroma",
      "prompt engineering",
      "fine-tuning",
      "fine tuning",
      "llm",
      "gpt",
      "claude",
      "gemini",
      "anthropic",
      "openai",
      "generative ai",
      "hugging face",
      "huggingface",
    ],
  },
];

export type CoreStrengthBreakdown = Partial<Record<SkillDomainId, number>>;

export function normalizeSkillToken(skill: string): string {
  return skill.trim().toLowerCase();
}

function skillMatchesKeyword(skill: string, keyword: string): boolean {
  const s = normalizeSkillToken(skill);
  const k = normalizeSkillToken(keyword);
  if (k.length < 2) return false;
  if (s === k) return true;
  if (s.includes(k)) return true;
  if (k.includes(" ") && s.includes(k.replace(/\s+/g, ""))) return true;
  return false;
}

export function classifySkillToDomain(skill: string): SkillDomainId | null {
  for (const domain of SKILL_DOMAINS) {
    if (domain.keywords.some((kw) => skillMatchesKeyword(skill, kw))) {
      return domain.id;
    }
  }
  return null;
}

export function computeCoreStrengthFromVerifiedSkills(
  verifiedSkills: { skill: string }[],
): {
  core_strength_primary: string | null;
  core_strength_secondary: string | null;
  core_strength_breakdown: CoreStrengthBreakdown;
} {
  const breakdown: CoreStrengthBreakdown = {};

  for (const { skill } of verifiedSkills) {
    const domainId = classifySkillToDomain(skill);
    if (!domainId) continue;
    breakdown[domainId] = (breakdown[domainId] ?? 0) + 1;
  }

  const ranked = Object.entries(breakdown)
    .filter(([, count]) => (count ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));

  const labelFor = (id: string) =>
    SKILL_DOMAINS.find((d) => d.id === id)?.label ?? id;

  const primary = ranked[0]?.[0] as SkillDomainId | undefined;
  const secondary = ranked[1]?.[0] as SkillDomainId | undefined;

  return {
    core_strength_primary: primary ? labelFor(primary) : null,
    core_strength_secondary: secondary ? labelFor(secondary) : null,
    core_strength_breakdown: breakdown,
  };
}

export function domainIdFromLabel(label: string | null | undefined): SkillDomainId | null {
  if (!label?.trim()) return null;
  const lower = label.trim().toLowerCase();
  const found = SKILL_DOMAINS.find(
    (d) => d.label.toLowerCase() === lower || d.id.replace("_", " ") === lower,
  );
  return found?.id ?? null;
}

/** Domains implied by role must-haves and core signals (top two by signal count). */
export function primaryRoleDomains(roleBrief: {
  deal_breakers: string[];
  core_signals: { skill: string; equivalents?: string[] }[];
}): SkillDomainId[] {
  const counts: CoreStrengthBreakdown = {};
  const terms: string[] = [
    ...(roleBrief.deal_breakers ?? []),
    ...(roleBrief.core_signals ?? []).flatMap((s) => [
      s.skill,
      ...(s.equivalents ?? []),
    ]),
  ];
  for (const term of terms) {
    const id = classifySkillToDomain(term);
    if (id) counts[id] = (counts[id] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 2)
    .map(([id]) => id as SkillDomainId);
}

export function coreStrengthOverlapsRole(
  profile: {
    core_strength_primary: string | null;
    core_strength_secondary: string | null;
  },
  roleDomainIds: SkillDomainId[],
): boolean {
  if (roleDomainIds.length === 0) return true;
  const candidateIds = [
    domainIdFromLabel(profile.core_strength_primary),
    domainIdFromLabel(profile.core_strength_secondary),
  ].filter(Boolean) as SkillDomainId[];
  if (candidateIds.length === 0) return false;
  return candidateIds.some((id) => roleDomainIds.includes(id));
}

export function formatCoreStrengthLabel(
  primary: string | null | undefined,
  secondary: string | null | undefined,
): string | null {
  const p = primary?.trim();
  const s = secondary?.trim();
  if (p && s) return `${p} + ${s}`;
  if (p) return p;
  if (s) return s;
  return null;
}
