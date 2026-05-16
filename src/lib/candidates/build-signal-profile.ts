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
  extractCurrentCompany,
  extractExplicitYearsOfExperience,
  extractFirstSubstantialLine,
  extractLocation,
  extractProfessionalSummary,
  extractTitleFromResumeHeader,
  parseEducationEntries,
  parseExperienceWithFallback,
  parseSkillsFromSection,
  splitResumeSections,
  summaryFromRecentRole,
} from "./parse-resume-structure";
import { prepareSignalQuote, toStrippedResumeText } from "./resume-text";

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

  let professional_summary = extractProfessionalSummary(resumeText, rawSections);
  if (!professional_summary || professional_summary.length < 40) {
    professional_summary = summaryFromRecentRole(experience);
  }
  if (!professional_summary || professional_summary.length < 40) {
    professional_summary = extractFirstSubstantialLine(resumeText);
  }

  const career_types_sequence = experience.map((e) => e.company_type);
  const career_pattern =
    career_types_sequence.length > 0
      ? career_types_sequence.join(" → ")
      : "Not available";

  const identity = parseResumeIdentity(resumeText, resumeFilename);
  const { linkedin_url, portfolio_links } = extractResumeLinks(resumeText);
  const display_name = identity.display_name;

  const title_band = inferTitleBand(
    experience[0]?.title ?? professional_summary.slice(0, 200),
  );
  const recentRole = experience.find((e) => isValidExperienceEntry(e));
  const experienceTitle = recentRole?.title.trim();
  const headerTitle = extractTitleFromResumeHeader(resumeText)?.trim();
  const most_recent_title =
    experienceTitle ||
    (headerTitle && !isSummaryLikeTitle(headerTitle) ? headerTitle : "") ||
    "";
  const current_company =
    recentRole?.company.trim() ||
    extractCurrentCompany(resumeText)?.trim() ||
    null;
  const location = extractLocation(resumeText);
  const explicitYears = extractExplicitYearsOfExperience(resumeText, rawSections);
  const fromRoles = estimateYearsExperience(experience);
  const total_years_experience =
    fromRoles !== "Not stated"
      ? fromRoles
      : explicitYears != null
        ? `${Math.round(explicitYears)} years`
        : "Not stated";
  const trajectory_velocity = computeTrajectoryVelocity(experience);

  return {
    display_name,
    first_name: identity.first_name,
    last_name: identity.last_name,
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
