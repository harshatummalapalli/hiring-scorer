/**
 * Fetches MIND __aggregated_skills.json and regenerates src/lib/intelligence/tech-graph.ts
 *
 * Run (from repo root): npx tsx scripts/generate-tech-graph.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const MIND_URL =
  "https://raw.githubusercontent.com/MIND-TechAI/MIND-tech-ontology/main/__aggregated_skills.json";

type MindSkill = {
  name: string;
  synonyms?: string[];
  type?: string[];
  technicalDomains?: string[];
  impliesKnowingSkills?: string[];
  solvesApplicationTasks?: string[];
};

type TechCategory = "language" | "framework" | "database" | "tool";
type TechDomain =
  | "ai_engineering"
  | "data_science"
  | "backend"
  | "frontend"
  | "fullstack"
  | "devops"
  | "mobile"
  | "cross_domain";

type TechNode = {
  canonical: string;
  aliases: string[];
  category: TechCategory;
  domain: TechDomain;
  implies: string[];
  equivalentTo: string[];
  senioritySignal: string;
  roleSignals: string[];
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function mapCategory(type0: string | undefined): TechCategory {
  const t = (type0 ?? "Tool").trim();
  switch (t) {
    case "ProgrammingLanguage":
    case "Programming Language":
      return "language";
    case "Framework":
      return "framework";
    case "Library":
      return "framework";
    case "Database":
      return "database";
    case "Tool":
    case "Service":
    case "Protocol":
      return "tool";
    case "Markup Language":
    case "MarkupLanguage":
      return "tool";
    default:
      return "tool";
  }
}

function mapDomain(first: string | undefined): TechDomain {
  if (!first?.trim()) return "cross_domain";
  const d = first.trim();
  switch (d) {
    case "ML/AI":
    case "MLOps":
      return "ai_engineering";
    case "Data Engineering":
    case "Data Science":
      return "data_science";
    case "Backend":
      return "backend";
    case "Frontend":
      return "frontend";
    case "Fullstack":
      return "fullstack";
    case "DevOps":
      return "devops";
    case "Mobile":
      return "mobile";
    case "QA/Testing":
    case "Cybersecurity":
      return "cross_domain";
    default:
      return "cross_domain";
  }
}

function uniqueStrings(arr: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of arr) {
    const t = x.trim();
    if (!t) continue;
    const k = normalizeToken(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function mergeMindRows(a: MindSkill, b: MindSkill): MindSkill {
  return {
    name: a.name,
    synonyms: uniqueStrings([...(a.synonyms ?? []), ...(b.synonyms ?? [])]),
    type: a.type?.length ? a.type : b.type,
    technicalDomains: a.technicalDomains?.length
      ? a.technicalDomains
      : b.technicalDomains,
    impliesKnowingSkills: uniqueStrings([
      ...(a.impliesKnowingSkills ?? []),
      ...(b.impliesKnowingSkills ?? []),
    ]),
    solvesApplicationTasks: uniqueStrings([
      ...(a.solvesApplicationTasks ?? []),
      ...(b.solvesApplicationTasks ?? []),
    ]),
  };
}

function mindToTechNode(raw: MindSkill): TechNode {
  const canonical = raw.name.trim();
  const syn = (raw.synonyms ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const aliases = uniqueStrings([...syn, canonical.toLowerCase()]);

  const tasks = (raw.solvesApplicationTasks ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3);

  return {
    canonical,
    aliases,
    category: mapCategory(raw.type?.[0]),
    domain: mapDomain(raw.technicalDomains?.[0]),
    implies: uniqueStrings(raw.impliesKnowingSkills ?? []),
    equivalentTo: [],
    senioritySignal: "any",
    roleSignals: tasks,
  };
}

const UTILITIES = String.raw`// —— Lookup indexes ——

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const CANONICAL_BY_KEY = new Map<string, TechNode>();
const ALIAS_TO_CANONICAL = new Map<string, string>();

for (const node of TECH_GRAPH) {
  CANONICAL_BY_KEY.set(normalizeToken(node.canonical), node);
  ALIAS_TO_CANONICAL.set(normalizeToken(node.canonical), node.canonical);
  for (const alias of node.aliases) {
    ALIAS_TO_CANONICAL.set(normalizeToken(alias), node.canonical);
  }
}

function tokenMatches(skill: string, token: string): boolean {
  const s = normalizeToken(skill);
  const t = normalizeToken(token);
  if (!s || !t) return false;
  if (s === t) return true;
  if (t.length >= 3 && s.includes(t)) return true;
  if (s.length >= 3 && t.includes(s)) return true;
  return false;
}

/** Resolve a skill string to its graph node (canonical or alias). */
export function findTechNode(skill: string): TechNode | null {
  const key = normalizeToken(skill);
  const direct = CANONICAL_BY_KEY.get(key);
  if (direct) return direct;

  const viaAlias = ALIAS_TO_CANONICAL.get(key);
  if (viaAlias) return CANONICAL_BY_KEY.get(normalizeToken(viaAlias)) ?? null;

  for (const node of TECH_GRAPH) {
    if (node.aliases.some((a) => tokenMatches(skill, a))) return node;
    if (tokenMatches(skill, node.canonical)) return node;
  }
  return null;
}

function nodeByCanonical(canonical: string): TechNode | null {
  return CANONICAL_BY_KEY.get(normalizeToken(canonical)) ?? null;
}

/** Collect all technologies equivalent to the given skill (includes canonical). */
export function expandEquivalents(skill: string): string[] {
  const start = findTechNode(skill);
  if (!start) return skill.trim() ? [skill.trim()] : [];

  const visited = new Set<string>();
  const queue = [start.canonical];

  while (queue.length > 0) {
    const name = queue.pop()!;
    if (visited.has(name)) continue;
    visited.add(name);

    const node = nodeByCanonical(name);
    if (!node) continue;

    for (const eq of node.equivalentTo) {
      if (!visited.has(eq)) queue.push(eq);
    }
    for (const other of TECH_GRAPH) {
      if (other.equivalentTo.some((e) => normalizeToken(e) === normalizeToken(name))) {
        if (!visited.has(other.canonical)) queue.push(other.canonical);
      }
    }
  }

  return [...visited];
}

/** Given explicit skills, return additional implied canonical skills. */
export function inferImplied(skills: string[]): string[] {
  const implied = new Set<string>();
  const explicit = new Set<string>();

  for (const skill of skills) {
    const node = findTechNode(skill);
    if (!node) continue;
    explicit.add(node.canonical);
    for (const name of node.implies) {
      if (nodeByCanonical(name)) implied.add(name);
    }
  }

  for (const name of explicit) implied.delete(name);
  return [...implied];
}

/** Return human-readable dominant domain for a skill list. */
export function classifyDomain(skills: string[]): string {
  const counts = new Map<TechDomain, number>();

  for (const skill of skills) {
    const node = findTechNode(skill);
    if (!node) continue;
    counts.set(node.domain, (counts.get(node.domain) ?? 0) + 1);
  }

  if (counts.size === 0) return DOMAIN_LABELS.cross_domain;

  const [topDomain] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return DOMAIN_LABELS[topDomain[0]];
}

/** Map each must-have to its equivalence group (canonical + equivalents). */
export function expandMustHaves(
  mustHaves: string[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};

  for (const mh of mustHaves) {
    const trimmed = mh.trim();
    if (!trimmed) continue;
    const group = expandEquivalents(trimmed);
    out[trimmed] = group.length > 0 ? group : [trimmed];
  }

  return out;
}
`;

async function main() {
  console.log("Fetching", MIND_URL);
  const res = await fetch(MIND_URL);
  if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
  const list = (await res.json()) as MindSkill[];

  const byNorm = new Map<string, MindSkill>();
  let duplicateCount = 0;
  for (const raw of list) {
    const name = raw?.name;
    if (typeof name !== "string" || !name.trim()) continue;
    const key = normalizeToken(name);
    const prev = byNorm.get(key);
    if (prev) {
      duplicateCount++;
      byNorm.set(key, mergeMindRows(prev, raw));
    } else {
      byNorm.set(key, raw);
    }
  }

  const nodes: TechNode[] = [...byNorm.values()].map(mindToTechNode);
  nodes.sort((a, b) => a.canonical.localeCompare(b.canonical));

  const overridePath = path.join(__dirname, "tech-graph-equivalent-overrides.json");
  const equivRaw = JSON.parse(fs.readFileSync(overridePath, "utf8")) as Record<
    string,
    string[]
  >;

  let overrideHits = 0;
  for (const node of nodes) {
    const o = equivRaw[node.canonical];
    if (!o) continue;
    overrideHits++;
    node.equivalentTo = [...o];
  }

  console.log(`Total raw skills: ${list.length}`);
  console.log(`Merged duplicates: ${duplicateCount}`);
  console.log(`Output nodes: ${nodes.length}`);
  console.log(`equivalentTo overrides applied: ${overrideHits}`);

  const dataJson = JSON.stringify(nodes);
  const header = `// Auto-generated from MIND Tech Ontology (MIT License)
// Source: github.com/MIND-TechAI/MIND-tech-ontology
// Generated: ${new Date().toISOString()}
// Total nodes: ${nodes.length}
//
// Editorial equivalentTo relationships merged from scripts/tech-graph-equivalent-overrides.json
`;

  const outfile = path.join(
    ROOT,
    "src/lib/intelligence/tech-graph.ts",
  );

  const body = `${header}
import {
  DOMAIN_LABELS,
  type TechCategory,
  type TechDomain,
  type TechNode,
} from "./tech-graph-types";

export type { TechCategory, TechDomain, TechNode };

export const TECH_GRAPH: TechNode[] = JSON.parse(${JSON.stringify(dataJson)}) as TechNode[];

${UTILITIES}
`;

  fs.writeFileSync(outfile, body, "utf8");
  console.log("Wrote", outfile);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
