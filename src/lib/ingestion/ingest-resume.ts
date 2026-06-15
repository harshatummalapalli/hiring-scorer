import { extractResumeTextFromBytes } from "@/lib/resume/parse-resume";
import { normalizeResumeText } from "@/lib/resume/normalize-resume-text";
import { parseResumeWithGemini, type GeminiParseUsage } from "@/lib/ai/gemini-resume-parser";
import type { GeminiParsedResume } from "@/lib/ai/gemini-resume-parser";
import { isGoogleApiKeyAuthError } from "@/lib/ai/api-keys";
import { isGeminiParsingConfigured } from "@/lib/gemini-client";
import { computeResumeContentHash } from "@/lib/candidates/resume-content-hash";
import { getParseCache, setParseCache } from "@/lib/ingestion/parse-cache";
import { PARSE_VERSIONS } from "@/lib/ingestion/parse-versions";
import { buildSignalProfile } from "@/lib/candidates/build-signal-profile";
import type { CandidateSignalProfile } from "@/types/candidate";
import type { StructuredResume } from "@/types/structured-resume";
import type { CompanyType } from "@/types/score";
import { analyseResumeSignals } from "@/lib/intelligence/beyond-keywords";
import {
  resolveDisplayRole,
  isInvalidDisplaySkill,
} from "@/lib/candidates/candidate-identity-display";
import { isValidExperienceEntry } from "@/lib/candidates/profile-display";
import { estimateYearsExperience } from "@/lib/candidates/parse-resume-structure";

export type IngestionSource = "gemini_parser" | "legacy_parser";

export type IngestResumeResult = {
  resumeText: string;
  strippedResumeText: string;
  signalProfile: CandidateSignalProfile;
  geminiRecord: GeminiParsedResume | null;
  structuredResume: StructuredResume | null;
  parseResult: null;
  ingestionSource: IngestionSource;
  parseWarning?: string | null;
  parseCacheHit?: boolean;
  parseUsage?: GeminiParseUsage;
};

export async function ingestResumeFromText(
  rawText: string,
  filename: string,
): Promise<IngestResumeResult> {
  const resumeText = normalizeResumeText(rawText);

  if (!resumeText || resumeText.length < 100) {
    throw new Error(
      "Resume text is too short to parse. The file may be empty or image-only.",
    );
  }

  const strippedResumeText = stripPiiLocally(resumeText);
  const contentHash = computeResumeContentHash(resumeText);
  const cacheKey = {
    contentHash,
    parserVersion: PARSE_VERSIONS.PARSER,
    promptVersion: PARSE_VERSIONS.PROMPT,
    schemaVersion: PARSE_VERSIONS.SCHEMA,
  };

  if (isGeminiParsingConfigured()) {
    const cachedProfile = await getParseCache(cacheKey);
    if (cachedProfile) {
      return {
        resumeText,
        strippedResumeText,
        signalProfile: cachedProfile,
        geminiRecord: null,
        structuredResume: null,
        parseResult: null,
        ingestionSource: "gemini_parser",
        parseCacheHit: true,
      };
    }

    try {
      const { record: geminiRecord, usage: parseUsage } =
        await parseResumeWithGemini(resumeText);
      const signalProfile = geminiRecordToSignalProfile(
        geminiRecord,
        filename,
        resumeText,
      );

      void setParseCache(cacheKey, signalProfile);

      return {
        resumeText,
        strippedResumeText,
        signalProfile,
        geminiRecord,
        structuredResume: null,
        parseResult: null,
        ingestionSource: "gemini_parser",
        parseCacheHit: false,
        parseUsage,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[ingest-resume] Gemini parse failed for ${filename}, falling back to legacy parser:`,
        message,
      );
      return ingestWithLegacyParser(
        resumeText,
        strippedResumeText,
        filename,
        isGoogleApiKeyAuthError(message)
          ? "AI resume parser unavailable (check Gemini credentials). Parsed with built-in extractor."
          : "AI resume parser unavailable. Parsed with built-in extractor.",
      );
    }
  }

  console.warn(
    `[ingest-resume] Gemini parse lane not configured; using legacy parser for ${filename}`,
  );
  return ingestWithLegacyParser(
    resumeText,
    strippedResumeText,
    filename,
    "Set GOOGLE_VERTEX_CREDENTIALS (Vertex) or GEMINI_API_KEY with USE_GEMINI_STUDIO=true for richer resume parsing. Using built-in extractor.",
  );
}

function ingestWithLegacyParser(
  resumeText: string,
  strippedResumeText: string,
  filename: string,
  parseWarning: string | null,
): IngestResumeResult {
  const signalProfile = buildSignalProfile(resumeText, filename);
  return {
    resumeText,
    strippedResumeText,
    signalProfile: {
      ...signalProfile,
      ingestion_source: "legacy_parser",
    },
    geminiRecord: null,
    structuredResume: null,
    parseResult: null,
    ingestionSource: "legacy_parser",
    parseWarning,
  };
}

// Email-inbound path (receives raw PDF/DOCX/TXT bytes)
export async function ingestResumeFromBytes(
  bytes: ArrayBuffer,
  filename: string,
): Promise<IngestResumeResult> {
  const text = await extractResumeTextFromBytes(bytes, filename);
  return ingestResumeFromText(text, filename);
}

// ─── PII Stripping ────────────────────────────────────────────────────────────
// Runs locally in Next.js. GPT-4o Mini only ever receives stripped text.

const EMAIL_RE =
  /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/gi;
const PHONE_RE =
  /(?:\+91[\s.\-]*)?[6-9]\d{9}\b|\+?\d{1,3}[\s.\-]?\(?\d{2,4}\)?[\s.\-]?\d{2,4}[\s.\-]?\d{2,9}\b|\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}\b/g;
const URL_RE =
  /https?:\/\/[^\s<>"')[\]]+|\bwww\.[^\s<>"')[\]]+|\blinkedin\.com\/[^\s]+|\bgithub\.com\/[^\s]+/gi;
const NAME_HEADER_RE =
  /^([A-Z][a-z]{1,30}(?:\s+[A-Z][a-z.'\-]{1,30}){1,3})\s*$/m;

function stripPiiLocally(text: string): string {
  let out = text;
  out = out.replace(EMAIL_RE, "[EMAIL]");
  out = out.replace(PHONE_RE, "[PHONE]");
  out = out.replace(URL_RE, "[URL]");
  out = out.replace(NAME_HEADER_RE, "[CANDIDATE]");
  return out;
}

// ─── Signal Profile Builder ───────────────────────────────────────────────────

function geminiRecordToSignalProfile(
  record: GeminiParsedResume,
  filename: string,
  resumeText: string,
): CandidateSignalProfile {
  const allSkills = record.skill_groups
    .flatMap((g) => g.skills)
    .filter((s) => !isInvalidDisplaySkill(s));

  const experience = record.work_history
    .map((w) => ({
      title: w.title,
      company: w.company,
      company_type: "Services" as CompanyType,
      location: null,
      start_date: w.start ?? null,
      end_date: w.end ?? null,
      bullets: w.bullets,
    }))
    .filter((entry) => isValidExperienceEntry(entry));

  const { title: current_title, company: current_company } = resolveDisplayRole({
    currentTitle: record.current_title,
    currentCompany: record.current_company,
    experience,
  });

  let total_years_experience = record.total_years_experience?.trim() || "";
  if (!total_years_experience || /^not\s+stated$/i.test(total_years_experience)) {
    const estimated = estimateYearsExperience(experience);
    total_years_experience = /^not\s+stated$/i.test(estimated) ? "" : estimated;
  }

  const career_gaps = (record.career_gaps ?? [])
    .map((g) => ({ months: Math.max(0, Number(g.months) || 0) }))
    .filter((g) => g.months > 0);

  const validSkills = allSkills.slice(0, 20);
  const resumeQuality = analyseResumeSignals(stripPiiLocally(resumeText));

  return {
    display_name:
      record.full_name ??
      filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
    first_name: record.full_name?.split(" ")[0] ?? "",
    last_name: record.full_name?.split(" ").slice(1).join(" ") ?? "",
    current_title,
    most_recent_title: current_title ?? experience[0]?.title ?? "",
    current_company,
    location: record.location ?? null,
    total_years_experience,
    linkedin_url: record.linkedin_url ?? null,
    portfolio_links: [],
    career_pattern: "",
    career_types_sequence: [],
    shows_product_progression: false,
    professional_summary: record.career_summary ?? "",
    resume_quality: resumeQuality,
    ownership_ratio_percent: resumeQuality.ownership.ratio_percent,
    quantification_ratio_percent: resumeQuality.quantification.ratio_percent,
    quantification_level: resumeQuality.quantification.level,
    keyword_stuffing_flagged: resumeQuality.keyword_stuffing.flagged,
    keyword_stuffing_explanation: resumeQuality.keyword_stuffing.explanation,
    trajectory_velocity: "normal",
    positive_signals: [],
    watch_signals: [],
    experience,
    experience_fallback_raw: null,
    education: record.education,
    skills_verified: validSkills.map((s) => ({
      skill: s,
      evidence: "",
    })),
    skills_listed_only: [],
    top_skills: validSkills,
    title_band: null,
    core_strength_primary: validSkills[0] ?? null,
    core_strength_secondary: validSkills[1] ?? null,
    core_strength_breakdown: {},
    extracted_email: record.email ?? null,
    extracted_phone: record.phone ?? null,
    ingestion_source: "gemini_parser",
    career_gaps,
  };
}
