/**
 * Lightweight skill → pill style mapping (no tech-graph bundle).
 * Falls back to slate when unknown.
 */

export type SkillPillVariant =
  | "language"
  | "framework"
  | "database"
  | "ai_ml"
  | "devops"
  | "default";

const LANGUAGE = new Set(
  [
    "python",
    "java",
    "javascript",
    "typescript",
    "go",
    "golang",
    "rust",
    "c++",
    "c#",
    "ruby",
    "php",
    "swift",
    "kotlin",
    "scala",
    "r",
    "matlab",
  ].map((s) => s.toLowerCase()),
);

const FRAMEWORK = [
  "fastapi",
  "django",
  "flask",
  "spring",
  "react",
  "next.js",
  "nextjs",
  "vue",
  "angular",
  "node",
  "express",
  "nestjs",
  ".net",
  "rails",
  "laravel",
];

const DATABASE = [
  "postgresql",
  "postgres",
  "mysql",
  "mongodb",
  "redis",
  "dynamodb",
  "elasticsearch",
  "snowflake",
  "bigquery",
  "sqlite",
  "oracle",
  "cassandra",
];

const AI_ML = [
  "langchain",
  "pytorch",
  "tensorflow",
  "keras",
  "scikit",
  "sklearn",
  "hugging",
  "openai",
  "llm",
  "rag",
  "nlp",
  "machine learning",
  "deep learning",
];

const DEVOPS = [
  "docker",
  "kubernetes",
  "k8s",
  "terraform",
  "ansible",
  "jenkins",
  "github actions",
  "gitlab ci",
  "aws",
  "azure",
  "gcp",
  "helm",
  "ci/cd",
];

function matchesAny(skill: string, terms: string[]): boolean {
  const s = skill.toLowerCase();
  return terms.some((t) => s.includes(t));
}

export function skillPillVariant(skill: string): SkillPillVariant {
  const key = skill.trim().toLowerCase();
  if (!key) return "default";
  if (LANGUAGE.has(key)) return "language";
  for (const lang of LANGUAGE) {
    if (key.includes(lang)) return "language";
  }
  if (matchesAny(key, AI_ML)) return "ai_ml";
  if (matchesAny(key, DEVOPS)) return "devops";
  if (matchesAny(key, DATABASE)) return "database";
  if (matchesAny(key, FRAMEWORK)) return "framework";
  return "default";
}

export const SKILL_PILL_CLASSES: Record<SkillPillVariant, string> = {
  language: "skill-pill skill-pill--language",
  framework: "skill-pill skill-pill--framework",
  database: "skill-pill skill-pill--database",
  ai_ml: "skill-pill skill-pill--ai",
  devops: "skill-pill skill-pill--devops",
  default: "skill-pill skill-pill--default",
};

export function skillPillClassName(skill: string): string {
  return SKILL_PILL_CLASSES[skillPillVariant(skill)];
}
