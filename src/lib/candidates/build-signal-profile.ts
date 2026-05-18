import { analyseResumeSignals } from "@/lib/intelligence/beyond-keywords";
import { extractResumeLinks } from "@/lib/candidates/parse-resume-links";
import { parseResumeIdentity } from "@/lib/candidates/parse-resume-identity";
import type { CompanyType } from "@/types/score";
import type {
  CandidateSignalProfile,
  ProfileSignal,
  VerifiedSkill,
} from "@/types/candidate";
import {
  inferTitleBand,
  isSummaryLikeTitle,
  isValidExperienceEntry,
} from "./profile-display";
import {
  computeTrajectoryVelocity,
  estimateYearsExperience,
  extractExplicitYearsOfExperience,
  extractLocation,
  resolveProfessionalSummary,
  parseEducationEntries,
  parseExperienceWithFallback,
  parseSkillsFromSection,
  splitResumeSections,
} from "./parse-resume-structure";
import { extractCandidateFields } from "./extract-resume-fields";
import { polishTitleAndCompany } from "./extract-resume-header";
import { prepareSignalQuote, toStrippedResumeText } from "./resume-text";
import { computeCoreStrengthFromVerifiedSkills } from "@/lib/intelligence/skill-domains";
import { hashResumeContentPrefix } from "@/lib/candidates/resume-content-hash";

function skillInText(skill: string, text: string): { index: number; len: number } | null {
  const needle = skill.trim();
  if (!needle || needle.length < 2) return null;
  const pattern = new RegExp(
    `\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
    "i",
  );
  const match = pattern.exec(text);
  if (match?.index != null) {
    return { index: match.index, len: match[0].length };
  }
  const idx = text.toLowerCase().indexOf(needle.toLowerCase());
  if (idx >= 0) return { index: idx, len: needle.length };
  return null;
}

function extractContextQuote(
  resumeText: string,
  index: number,
  matchedLength: number,
): string {
  const target = 100;
  const matchEnd = index + matchedLength;
  let start = index;
  let end = matchEnd;
  while (end - start < target && (start > 0 || end < resumeText.length)) {
    if (start > 0 && end - start < target) start -= 1;
    if (end < resumeText.length && end - start < target) end += 1;
  }
  let quote = resumeText.slice(start, end).replace(/\s+/g, " ").trim();
  if (start > 0) quote = `…${quote}`;
  if (end < resumeText.length) quote = `${quote}…`;
  return quote.slice(0, 100);
}

function classifySkills(
  strippedResume: string,
  skillNames: string[],
  experienceBullets: string[],
): { verified: VerifiedSkill[]; listedOnly: string[] } {
  const workBlob = experienceBullets.join("\n").toLowerCase();
  const verified: VerifiedSkill[] = [];
  const listedOnly: string[] = [];
  const seen = new Set<string>();

  for (const skill of skillNames) {
    const key = skill.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const inWork = skillInText(skill, workBlob) != null;
    const inResume = skillInText(skill, strippedResume);

    if (inWork && inResume) {
      const rawQuote = extractContextQuote(
        strippedResume,
        inResume.index,
        inResume.len,
      );
      verified.push({
        skill,
        evidence: prepareSignalQuote(skill, rawQuote),
      });
    } else if (inResume || skillNames.includes(skill)) {
      listedOnly.push(skill);
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
    const signal = "Demonstrates ownership language";
    signals.push({
      signal,
      evidence: prepareSignalQuote(signal, ex.slice(0, 120)),
    });
  }
  for (const ex of quantifiedExamples.slice(0, 1)) {
    if (signals.length >= 3) break;
    const signal = "Quantified business impact";
    signals.push({
      signal,
      evidence: prepareSignalQuote(signal, ex.slice(0, 120)),
    });
  }
  if (signals.length === 0) {
    const signal = "Relevant professional background";
    signals.push({
      signal,
      evidence: prepareSignalQuote(signal, ""),
    });
  }
  return signals.slice(0, 3);
}

function buildWatchSignals(
  keywordFlagged: boolean,
  keywordExplanation: string,
  ownershipPercent: number,
): string[] {
  const watch: string[] = [];
  if (keywordFlagged) {
    watch.push(
      keywordExplanation ||
        "Skills section may be overstuffed relative to demonstrated work.",
    );
  }
  if (ownershipPercent < 35) {
    watch.push(
      "Limited ownership language in role bullets — verify individual contribution in screen.",
    );
  }
  return watch.slice(0, 2);
}

function detectProductProgression(types: CompanyType[]): boolean {
  if (types.length < 2) return false;
  const last = types[types.length - 1];
  if (last !== "Product") return false;
  return types.slice(0, -1).some((t) => t === "Services" || t === "GCC");
}

export function buildSignalProfile(
  resumeText: string,
  resumeFilename: string,
): CandidateSignalProfile {
  // Raw text → structural extraction (name, title, company, experience, education, skills, summary)
  const rawSections = splitResumeSections(resumeText);
  const { experience, experience_fallback_raw } = parseExperienceWithFallback(
    resumeText,
    rawSections,
  );
  const education = parseEducationEntries(rawSections);
  const skillsSection = parseSkillsFromSection(rawSections);

  // Stripped text → signal analysis only (ownership, quantification, keyword stuffing)
  const strippedResume = toStrippedResumeText(resumeText);
  const resumeQuality = analyseResumeSignals(strippedResume);
  const allBullets = experience.flatMap((e) => e.bullets);

  const { verified, listedOnly } = classifySkills(
    strippedResume,
    skillsSection,
    allBullets,
  );

  const career_types_sequence = experience.map((e) => e.company_type);
  const career_pattern =
    career_types_sequence.length > 0
      ? career_types_sequence.join(" → ")
      : "Not available";

  const extracted = extractCandidateFields(resumeText, resumeFilename);
  const identity = parseResumeIdentity(resumeText, resumeFilename);
  const { linkedin_url: linksLinkedin, portfolio_links } =
    extractResumeLinks(resumeText);
  const linkedin_url = extracted.linkedin_url ?? linksLinkedin;
  const display_name = extracted.full_name || identity.display_name;

  const headerTitle = extracted.current_title;
  const headerCompany = extracted.current_company;
  const recentRole = experience.find((e) => isValidExperienceEntry(e));
  const experienceTitle = recentRole?.title.trim();
  const experienceCompany = recentRole?.company.trim();

  const resolvedTitle =
    headerTitle?.trim() ||
    (experienceTitle && !isSummaryLikeTitle(experienceTitle)
      ? experienceTitle
      : "") ||
    "";
  const polished = polishTitleAndCompany(
    resolvedTitle || null,
    headerCompany?.trim() || experienceCompany || null,
  );
  const current_title = polished.current_title;
  const most_recent_title = polished.current_title ?? "";
  const current_company = polished.current_company;
  const location =
    extracted.location ?? extractLocation(resumeText);
  const explicitYears = extractExplicitYearsOfExperience(resumeText, rawSections);
  const fromRoles = estimateYearsExperience(experience);
  const total_years_experience =
    fromRoles !== "Not stated"
      ? fromRoles
      : extracted.experience_years != null
        ? `${Math.round(extracted.experience_years)} years`
        : explicitYears != null
          ? `${Math.round(explicitYears)} years`
          : extracted.total_years_experience;

  const professional_summary = resolveProfessionalSummary(
    resumeText,
    rawSections,
    experience,
    {
      totalYears: total_years_experience,
      mostRecentTitle: most_recent_title,
    },
  );

  const title_band = inferTitleBand(
    experience[0]?.title ?? professional_summary.slice(0, 200),
  );
  const trajectory_velocity = computeTrajectoryVelocity(experience);
  const coreStrength = computeCoreStrengthFromVerifiedSkills(verified);

  return {
    display_name,
    first_name: identity.first_name,
    last_name: identity.last_name,
    current_title,
    most_recent_title,
    current_company,
    location,
    total_years_experience,
    linkedin_url,
    portfolio_links,
    career_pattern,
    career_types_sequence,
    shows_product_progression: detectProductProgression(career_types_sequence),
    professional_summary,
    resume_quality: resumeQuality,
    ownership_ratio_percent: resumeQuality.ownership.ratio_percent,
    quantification_ratio_percent: resumeQuality.quantification.ratio_percent,
    quantification_level: resumeQuality.quantification.level,
    keyword_stuffing_flagged: resumeQuality.keyword_stuffing.flagged,
    keyword_stuffing_explanation: resumeQuality.keyword_stuffing.explanation,
    trajectory_velocity,
    positive_signals: buildPositiveSignals(
      resumeQuality.ownership.ownership_examples,
      resumeQuality.quantification.quantified_examples,
    ),
    watch_signals: buildWatchSignals(
      resumeQuality.keyword_stuffing.flagged,
      resumeQuality.keyword_stuffing.explanation,
      resumeQuality.ownership.ratio_percent,
    ),
    experience,
    experience_fallback_raw,
    education,
    skills_verified: verified,
    skills_listed_only: listedOnly,
    title_band,
    core_strength_primary: coreStrength.core_strength_primary,
    core_strength_secondary: coreStrength.core_strength_secondary,
    core_strength_breakdown: coreStrength.core_strength_breakdown,
    resume_content_hash: hashResumeContentPrefix(resumeText),
    extracted_email: extracted.extracted_email,
    extracted_phone: extracted.extracted_phone,
    experience_years: extracted.experience_years,
  };
}

/** Always re-parse resume text so list/detail stay in sync with the code parser. */
export function normalizeSignalProfile(
  _raw: unknown,
  resumeText: string,
  resumeFilename: string,
): CandidateSignalProfile {
  return buildSignalProfile(resumeText, resumeFilename);
}
