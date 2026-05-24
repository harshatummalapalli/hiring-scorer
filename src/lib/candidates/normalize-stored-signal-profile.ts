import {
  resolveDisplayRole,
  topSkillsForDisplay,
} from "@/lib/candidates/candidate-identity-display";
import { isValidExperienceEntry } from "@/lib/candidates/profile-display";
import { computeCoreStrengthFromVerifiedSkills } from "@/lib/intelligence/skill-domains";
import { analyseResumeSignals } from "@/lib/intelligence/beyond-keywords";
import {
  computeTrajectoryVelocity,
  estimateYearsExperience,
} from "@/lib/candidates/parse-resume-structure";
import type {
  CandidateSignalProfile,
  EducationEntry,
  ExperienceEntry,
  VerifiedSkill,
} from "@/types/candidate";
import type { CompanyType } from "@/types/score";

function isStoredStructuredProfile(raw: unknown): raw is Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  if (o.ingestion_source === "gemini_parser") return true;
  return (
    (Array.isArray(o.experience) && o.experience.length > 0) ||
    (Array.isArray(o.top_skills) && o.top_skills.length > 0) ||
    (Array.isArray(o.skills_verified) && o.skills_verified.length > 0)
  );
}

function parseExperience(value: unknown): ExperienceEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const title = String(row.title ?? "").trim();
      const company = String(row.company ?? "").trim();
      if (!title && !company) return null;
      return {
        title,
        company,
        company_type: (row.company_type as CompanyType) ?? "Services",
        location: row.location != null ? String(row.location) : null,
        start_date: row.start_date != null ? String(row.start_date) : null,
        end_date: row.end_date != null ? String(row.end_date) : null,
        bullets: Array.isArray(row.bullets)
          ? row.bullets.map((b) => String(b).trim()).filter(Boolean)
          : [],
      } satisfies ExperienceEntry;
    })
    .filter((x): x is ExperienceEntry => x != null && isValidExperienceEntry(x));
}

function parseEducation(value: unknown): EducationEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const institution = String(row.institution ?? "").trim();
      if (!institution) return null;
      return {
        institution,
        degree: row.degree != null ? String(row.degree) : null,
        field: row.field != null ? String(row.field) : null,
        year: row.year != null ? String(row.year) : null,
      } satisfies EducationEntry;
    })
    .filter((x): x is EducationEntry => x != null);
}

function parseVerifiedSkills(value: unknown): VerifiedSkill[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") {
        const skill = item.trim();
        return skill ? { skill, evidence: "" } : null;
      }
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const skill = String(row.skill ?? row.name ?? "").trim();
      if (!skill) return null;
      return {
        skill,
        evidence: String(row.evidence ?? ""),
      };
    })
    .filter((x): x is VerifiedSkill => x != null);
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter(Boolean);
}

function resolveTotalExperience(
  stored: string | null | undefined,
  experience: ExperienceEntry[],
): string {
  const trimmed = stored?.trim() ?? "";
  if (trimmed && !/^not\s+stated$/i.test(trimmed)) return trimmed;
  const estimated = estimateYearsExperience(experience);
  return /^not\s+stated$/i.test(estimated) ? "" : estimated;
}

/** Use persisted Gemini (or legacy insert) profile instead of re-parsing stripped text. */
export function profileFromStoredSignalProfile(
  raw: Record<string, unknown>,
  resumeText: string,
): CandidateSignalProfile {
  const experience = parseExperience(raw.experience);
  const education = parseEducation(raw.education);
  const skills_verified = parseVerifiedSkills(raw.skills_verified);
  const skills_listed_only = parseStringArray(raw.skills_listed_only);
  const top_skills = parseStringArray(raw.top_skills);
  const displayTopSkills = topSkillsForDisplay(
    top_skills,
    skills_verified,
    skills_listed_only,
  );

  const { title: current_title, company: current_company } = resolveDisplayRole({
    currentTitle:
      raw.current_title != null ? String(raw.current_title) : null,
    currentCompany:
      raw.current_company != null ? String(raw.current_company) : null,
    experience,
  });

  const total_years_experience = resolveTotalExperience(
    raw.total_years_experience != null
      ? String(raw.total_years_experience)
      : null,
    experience,
  );

  const resumeQuality = analyseResumeSignals(resumeText);
  const coreStrength =
    raw.core_strength_primary || raw.core_strength_secondary
      ? {
          core_strength_primary:
            raw.core_strength_primary != null
              ? String(raw.core_strength_primary)
              : null,
          core_strength_secondary:
            raw.core_strength_secondary != null
              ? String(raw.core_strength_secondary)
              : null,
          core_strength_breakdown:
            (raw.core_strength_breakdown as CandidateSignalProfile["core_strength_breakdown"]) ??
            {},
        }
      : computeCoreStrengthFromVerifiedSkills(skills_verified);

  const storedQuality = raw.resume_quality as
    | CandidateSignalProfile["resume_quality"]
    | undefined;

  return {
    display_name: String(raw.display_name ?? "Candidate"),
    first_name: String(raw.first_name ?? ""),
    last_name: String(raw.last_name ?? ""),
    current_title,
    most_recent_title:
      current_title ??
      String(raw.most_recent_title ?? experience[0]?.title ?? ""),
    current_company,
    location: raw.location != null ? String(raw.location) : null,
    total_years_experience,
    linkedin_url: raw.linkedin_url != null ? String(raw.linkedin_url) : null,
    portfolio_links: parseStringArray(raw.portfolio_links),
    career_pattern: String(raw.career_pattern ?? ""),
    career_types_sequence: Array.isArray(raw.career_types_sequence)
      ? (raw.career_types_sequence as CompanyType[])
      : [],
    shows_product_progression: raw.shows_product_progression === true,
    professional_summary: String(raw.professional_summary ?? ""),
    resume_quality: storedQuality ?? resumeQuality,
    ownership_ratio_percent: Number(
      raw.ownership_ratio_percent ?? resumeQuality.ownership.ratio_percent,
    ),
    quantification_ratio_percent: Number(
      raw.quantification_ratio_percent ??
        resumeQuality.quantification.ratio_percent,
    ),
    quantification_level:
      (raw.quantification_level as CandidateSignalProfile["quantification_level"]) ??
      resumeQuality.quantification.level,
    keyword_stuffing_flagged:
      raw.keyword_stuffing_flagged === true ||
      resumeQuality.keyword_stuffing.flagged,
    keyword_stuffing_explanation: String(
      raw.keyword_stuffing_explanation ??
        resumeQuality.keyword_stuffing.explanation,
    ),
    trajectory_velocity:
      (raw.trajectory_velocity as CandidateSignalProfile["trajectory_velocity"]) ??
      computeTrajectoryVelocity(experience),
    positive_signals: Array.isArray(raw.positive_signals)
      ? (raw.positive_signals as CandidateSignalProfile["positive_signals"])
      : [],
    watch_signals: parseStringArray(raw.watch_signals),
    experience,
    experience_fallback_raw:
      raw.experience_fallback_raw != null
        ? String(raw.experience_fallback_raw)
        : null,
    education,
    skills_verified,
    skills_listed_only,
    top_skills: displayTopSkills.length ? displayTopSkills : top_skills,
    title_band: raw.title_band != null ? String(raw.title_band) : null,
    core_strength_primary: coreStrength.core_strength_primary,
    core_strength_secondary: coreStrength.core_strength_secondary,
    core_strength_breakdown: coreStrength.core_strength_breakdown,
    github:
      (raw.github as CandidateSignalProfile["github"]) ?? null,
    resume_content_hash:
      raw.resume_content_hash != null
        ? String(raw.resume_content_hash)
        : null,
    extracted_email:
      raw.extracted_email != null ? String(raw.extracted_email) : null,
    extracted_phone:
      raw.extracted_phone != null ? String(raw.extracted_phone) : null,
    experience_years:
      raw.experience_years != null ? Number(raw.experience_years) : null,
    ingestion_source:
      raw.ingestion_source === "gemini_parser" ? "gemini_parser" : undefined,
    career_gaps: Array.isArray(raw.career_gaps)
      ? (raw.career_gaps as Array<{ months: number }>)
      : [],
  };
}

export function shouldUseStoredSignalProfile(raw: unknown): raw is Record<string, unknown> {
  return isStoredStructuredProfile(raw);
}
