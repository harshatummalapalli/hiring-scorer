import Anthropic from "@anthropic-ai/sdk";
import { getApiKey } from "@/lib/ai/api-keys";
import { parseJsonFromModel } from "@/lib/ai/parse-json";
import { dedupeRoleBriefAnalysis } from "@/lib/role-brief/dedupe-skills";
import type { JdRecruiterContext } from "@/types/job-posting";
import type { RoleBriefAnalysis, TitleBand } from "@/types/role-brief";
import { TITLE_BANDS } from "@/types/role-brief";

function buildRecruiterContextBlock(context?: JdRecruiterContext | null): string {
  if (!context) return "";
  const lines: string[] = [];
  if (context.job_title) lines.push(`- Job title: ${context.job_title}`);
  if (context.job_location) lines.push(`- Location: ${context.job_location}`);
  if (context.seniority_override) {
    lines.push(`- Seniority: ${context.seniority_override}`);
  }
  if (context.department) lines.push(`- Department: ${context.department}`);
  if (context.client_company_name) {
    lines.push(`- Company: ${context.client_company_name}`);
  }
  if (context.client_company_size) {
    lines.push(`- Company size: ${context.client_company_size}`);
  }
  if (context.client_company_brief) {
    lines.push(`- About the company: ${context.client_company_brief}`);
  }
  if (context.client_company_website) {
    lines.push(`- Company website: ${context.client_company_website}`);
  }
  if (lines.length === 0) return "";
  return `\n\nAdditional context provided by the recruiter:\n${lines.join("\n")}\n\nUse this context to calibrate your extraction. Seniority and company size should influence what you extract as must-haves versus preferred signals.`;
}

const ANALYSE_JD_SYSTEM = `You are an expert recruiter with 18 years of enterprise technology hiring experience. Analyse this job description and return a JSON object with these exact fields. deal_breakers as an array of strings — the absolute must-have requirements where absence disqualifies a candidate. core_signals as an array of objects each with skill name and equivalents array — the important skills that drive the score heavily. preferred_signals as an array of strings — nice to have items that boost score but absence does not penalise. cannot_assess as an array of strings — role-specific qualities that cannot be evaluated from a resume alone. equivalent_titles as an array of strings — all job titles that should be considered equivalent to the target role. title_band as a string — one of Intern Entry Mid Senior Lead Staff Principal Manager Senior Manager Director Senior Director VP C-Suite — choose the band that best matches the seniority implied by the job description. semantic_clusters as an object where each key is a required skill and value is an array of technologies that imply proficiency in that skill. suggested_weights as an object with integer fields weight_skills weight_trajectory weight_domain weight_seniority weight_tenure each from 1 to 10 reflecting how much the JD emphasises each dimension — if the JD heavily emphasises technical skills set weight_skills high; if it emphasises leadership set weight_trajectory and weight_seniority high; balance all five to sum roughly 25–40.

CANNOT_ASSESS rules:
- Include ONLY qualities that are specific to this role and genuinely unverifiable from a resume
- NEVER include generic soft skills such as: communication skills, interpersonal skills, organisational skills, planning skills, analytical skills, presentation skills, self-starter attitude, teamwork, leadership in general
- Only include cannot_assess items if they are explicitly called out as important in the job description AND cannot be inferred from work history
- Maximum 5 items in cannot_assess. If you cannot find 5 role-specific unverifiable qualities, return fewer. Do not pad with generic skills to reach 5.

Return JSON only, no explanation.`;

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((v) => String(v).trim()).filter(Boolean))];
}

function parseTitleBand(value: unknown): TitleBand {
  const v = String(value ?? "Mid").trim();
  const match = TITLE_BANDS.find(
    (b) => b.toLowerCase() === v.toLowerCase(),
  );
  return match ?? "Mid";
}

function clampWeight(n: unknown, fallback: number): number {
  const v = Number(n);
  if (Number.isNaN(v)) return fallback;
  return Math.max(1, Math.min(10, Math.round(v)));
}

function parseSuggestedWeights(
  value: unknown,
): RoleBriefAnalysis["suggested_weights"] | undefined {
  if (typeof value !== "object" || value == null) return undefined;
  const o = value as Record<string, unknown>;
  return {
    weight_skills: clampWeight(o.weight_skills, 5),
    weight_trajectory: clampWeight(o.weight_trajectory, 5),
    weight_domain: clampWeight(o.weight_domain, 5),
    weight_seniority: clampWeight(o.weight_seniority, 5),
    weight_tenure: clampWeight(o.weight_tenure, 5),
  };
}

export function parseRoleBriefAnalysis(raw: unknown): RoleBriefAnalysis {
  if (typeof raw !== "object" || raw == null) {
    throw new Error("Invalid analysis response from model.");
  }
  const o = raw as Record<string, unknown>;

  const core_signals = Array.isArray(o.core_signals)
    ? o.core_signals
        .map((item) => {
          if (typeof item !== "object" || item == null) return null;
          const row = item as Record<string, unknown>;
          const skill = String(row.skill ?? row.name ?? "").trim();
          if (!skill) return null;
          return {
            skill,
            equivalents: parseStringArray(row.equivalents),
          };
        })
        .filter((x): x is RoleBriefAnalysis["core_signals"][0] => x != null)
    : [];

  const semantic_clusters: Record<string, string[]> = {};
  if (typeof o.semantic_clusters === "object" && o.semantic_clusters != null) {
    for (const [key, val] of Object.entries(
      o.semantic_clusters as Record<string, unknown>,
    )) {
      const k = key.trim();
      if (!k) continue;
      semantic_clusters[k] = parseStringArray(val);
    }
  }

  return dedupeRoleBriefAnalysis({
    deal_breakers: parseStringArray(o.deal_breakers),
    core_signals,
    preferred_signals: parseStringArray(o.preferred_signals),
    cannot_assess: parseStringArray(o.cannot_assess),
    equivalent_titles: parseStringArray(o.equivalent_titles),
    title_band: parseTitleBand(o.title_band),
    semantic_clusters,
    suggested_weights: parseSuggestedWeights(o.suggested_weights),
  });
}

export async function analyseJobDescription(
  jobDescription: string,
  recruiterContext?: JdRecruiterContext | null,
): Promise<RoleBriefAnalysis> {
  const client = new Anthropic({ apiKey: getApiKey("anthropic") });
  const contextBlock = buildRecruiterContextBlock(recruiterContext);

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: ANALYSE_JD_SYSTEM,
    messages: [
      {
        role: "user",
        content: `${jobDescription.trim()}${contextBlock}`,
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text for role analysis.");
  }

  const parsed = parseJsonFromModel(textBlock.text);
  return parseRoleBriefAnalysis(parsed);
}
