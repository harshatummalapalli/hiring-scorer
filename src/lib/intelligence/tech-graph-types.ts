/**
 * Shared shapes for `tech-graph.ts` (MIND ontology import + utilities).
 */

export type TechCategory =
  | "language"
  | "framework"
  | "database"
  | "tool";

/** Derived from primary MIND technicalDomains bucket. */
export type TechDomain =
  | "ai_engineering"
  | "data_science"
  | "backend"
  | "frontend"
  | "fullstack"
  | "devops"
  | "mobile"
  | "cross_domain";

export type TechNode = {
  canonical: string;
  aliases: string[];
  category: TechCategory;
  domain: TechDomain;
  implies: string[];
  equivalentTo: string[];
  senioritySignal: string;
  roleSignals: string[];
};

export const DOMAIN_LABELS: Record<TechDomain, string> = {
  ai_engineering: "AI Engineering",
  data_science: "Data Science",
  backend: "Backend",
  frontend: "Frontend",
  fullstack: "Fullstack",
  devops: "DevOps",
  mobile: "Mobile",
  cross_domain: "Cross-domain",
};
