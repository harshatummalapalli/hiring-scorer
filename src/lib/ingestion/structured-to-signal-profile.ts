import { analyseResumeSignals } from "@/lib/intelligence/beyond-keywords";
import { computeCoreStrengthFromVerifiedSkills } from "@/lib/intelligence/skill-domains";
import { extractResumeLinks } from "@/lib/candidates/parse-resume-links";
import { parseResumeIdentity } from "@/lib/candidates/parse-resume-identity";
import {
  computeTrajectoryVelocity,
  extractLocation,
  inferCompanyType,
  resolveProfessionalSummary,
} from "@/lib/candidates/parse-resume-structure";
import {
  inferTitleBand,
  isSummaryLikeTitle,
} from "@/lib/candidates/profile-display";
import { polishTitleAndCompany } from "@/lib/candidates/extract-resume-header";
import { prepareSignalQuote, toStrippedResumeText } from "@/lib/candidates/resume-text";
import { hashResumeContentPrefix } from "@/lib/candidates/resume-content-hash";
import type {
  CandidateSignalProfile,
  EducationEntry,
  ExperienceEntry,
  ProfileSignal,
  VerifiedSkill,
} from "@/types/candidate";
import type { CompanyType } from "@/types/score";
import type { StructuredResume } from "@/types/structured-resume";

function fieldValue(
  field: { value: string } | null | undefined,
): string | null {
  return field?.value?.trim() || null;
}

function mapExperience(structured: StructuredResume): ExperienceEntry[] {
  const entries: ExperienceEntry[] = [];
  for (const exp of structured.experience) {
    const title = fieldValue(exp.title) ?? "";
    const company = fieldValue(exp.company) ?? "";
    if (!title && !company) continue;
    const company_type: CompanyType = inferCompanyType(
      company,
      exp.bullets.join(" "),
    );
    entries.push({
      title: title || "Role",
      company: company || "Company",
      company_type,
      location: null,
      start_date: exp.start_date ?? null,
      end_date: exp.end_date ?? null,
      bullets: exp.bullets.slice(0, 8),
    });
  }
  return entries;
}

function mapEducation(structured: StructuredResume): EducationEntry[] {
  return structured.education.map((ed) => ({
    institution: ed.institution,
    degree: ed.degree ?? null,
    field: ed.field ?? null,
    year: ed.year ?? null,
  }));
}

function mapSkills(structured: StructuredResume): {
  verified: VerifiedSkill[];
  listedOnly: string[];
} {
  const verified: VerifiedSkill[] = [];
  const listedOnly: string[] = [];
  const seen = new Set<string>();

  for (const s of structured.skills) {
    const name = s.normalized_skill || s.skill;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (s.demonstrated && s.evidence) {
      verified.push({
        skill: name,
        evidence: prepareSignalQuote(name, s.evidence.slice(0, 100)),
      });
    } else if (s.listed_only || !s.demonstrated) {
      listedOnly.push(name);
    } else {
      verified.push({
        skill: name,
        evidence: prepareSignalQuote(name, s.skill),
      });
    }
  }
  return { verified, listedOnly };
}

function buildPositiveSignals(
  ownershipExamples: string[],
  quantifiedExamples: string[],
): ProfileSignal[] {
  const signals: ProfileSignal[] = [];
  for (const ex of ownershipExamples.slice(0, 2)) {
    signals.push({
      signal: "Demonstrates ownership language",
      evidence: prepareSignalQuote("ownership", ex.slice(0, 120)),
    });
  }
  for (const ex of quantifiedExamples.slice(0, 1)) {
    if (signals.length >= 3) break;
    signals.push({
      signal: "Quantified business impact",
      evidence: prepareSignalQuote("impact", ex.slice(0, 120)),
    });
  }
  if (signals.length === 0) {
    signals.push({
      signal: "Relevant professional background",
      evidence: prepareSignalQuote("background", ""),
    });
  }
  return signals.slice(0, 3);
}

function formatYears(structured: StructuredResume): string {
  const years = structured.timeline.total_experience_years;
  if (years > 0) return `${Math.round(years)} years`;
  return "Not stated";
}

function detectProductProgression(types: CompanyType[]): boolean {
  if (types.length < 2) return false;
  const last = types[types.length - 1];
  if (last !== "Product") return false;
  return types.slice(0, -1).some((t) => t === "Services" || t === "GCC");
}

/**
 * Map canonical structured resume → legacy CandidateSignalProfile for UI/scoring.
 */
export function structuredResumeToSignalProfile(
  structured: StructuredResume,
  resumeFilename: string,
): CandidateSignalProfile {
  const resumeText = structured.raw_text || structured.pii_stripped_text;
  const strippedResume = structured.pii_stripped_text
    ? structured.pii_stripped_text
    : toStrippedResumeText(resumeText);

  const experience = mapExperience(structured);
  const education = mapEducation(structured);
  const { verified, listedOnly } = mapSkills(structured);
  const resumeQuality = analyseResumeSignals(strippedResume);

  const identity = parseResumeIdentity(resumeText, resumeFilename);
  const { linkedin_url: linksLinkedin, portfolio_links } =
    extractResumeLinks(resumeText);

  const display_name =
    fieldValue(structured.basics.full_name) || identity.display_name;
  const linkedin_url =
    fieldValue(structured.basics.linkedin) ?? linksLinkedin;
  const location =
    fieldValue(structured.basics.location) ?? extractLocation(resumeText);

  const recentRole = experience[0];
  const resolvedTitle =
    structured.timeline.current_role_title?.trim() ||
    fieldValue(structured.experience[0]?.title) ||
    recentRole?.title ||
    "";
  const polished = polishTitleAndCompany(
    resolvedTitle && !isSummaryLikeTitle(resolvedTitle) ? resolvedTitle : null,
    structured.timeline.current_role_company?.trim() ||
      recentRole?.company ||
      null,
  );

  const career_types_sequence = experience.map((e) => e.company_type);
  const professional_summary =
    fieldValue(structured.basics.summary) ||
    resolveProfessionalSummary(resumeText, new Map(), experience, {
      totalYears: formatYears(structured),
      mostRecentTitle: polished.current_title ?? "",
    });

  const coreStrength = computeCoreStrengthFromVerifiedSkills(verified);

  return {
    display_name,
    first_name: identity.first_name,
    last_name: identity.last_name,
    current_title: polished.current_title,
    most_recent_title: polished.current_title ?? "",
    current_company: polished.current_company,
    location,
    total_years_experience: formatYears(structured),
    linkedin_url,
    portfolio_links,
    career_pattern:
      career_types_sequence.length > 0
        ? career_types_sequence.join(" → ")
        : "Not available",
    career_types_sequence,
    shows_product_progression: detectProductProgression(career_types_sequence),
    professional_summary,
    resume_quality: resumeQuality,
    ownership_ratio_percent: resumeQuality.ownership.ratio_percent,
    quantification_ratio_percent: resumeQuality.quantification.ratio_percent,
    quantification_level: resumeQuality.quantification.level,
    keyword_stuffing_flagged: resumeQuality.keyword_stuffing.flagged,
    keyword_stuffing_explanation: resumeQuality.keyword_stuffing.explanation,
    trajectory_velocity: computeTrajectoryVelocity(experience),
    positive_signals: buildPositiveSignals(
      resumeQuality.ownership.ownership_examples,
      resumeQuality.quantification.quantified_examples,
    ),
    watch_signals: resumeQuality.keyword_stuffing.flagged
      ? [resumeQuality.keyword_stuffing.explanation]
      : [],
    experience,
    experience_fallback_raw: experience.length === 0 ? resumeText.slice(0, 2000) : null,
    education,
    skills_verified: verified,
    skills_listed_only: listedOnly,
    title_band: inferTitleBand(
      experience[0]?.title ?? professional_summary.slice(0, 200),
    ),
    core_strength_primary: coreStrength.core_strength_primary,
    core_strength_secondary: coreStrength.core_strength_secondary,
    core_strength_breakdown: coreStrength.core_strength_breakdown,
    resume_content_hash: hashResumeContentPrefix(resumeText),
    extracted_email: fieldValue(structured.basics.email),
    extracted_phone: fieldValue(structured.basics.phone),
    experience_years: structured.timeline.total_experience_years || null,
  };
}
