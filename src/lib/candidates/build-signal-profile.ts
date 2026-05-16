import { analyseResumeSignals } from "@/lib/intelligence/beyond-keywords";
import { filenameToDisplayName } from "@/lib/scoring/recruiter-card";
import type { CompanyType } from "@/types/score";
import type {
  CandidateSignalProfile,
  ProfileSignal,
  VerifiedSkill,
} from "@/types/candidate";
import {
  computeTrajectoryVelocity,
  estimateYearsExperience,
  extractLocation,
  extractProfessionalSummary,
  inferCompanyType,
  parseEducationEntries,
  parseExperienceEntries,
  parseSkillsFromSection,
  splitResumeSections,
  summaryFromRecentRole,
} from "./parse-resume-structure";
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
  resumeText: string,
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
    const inResume = skillInText(skill, resumeText);

    if (inWork && inResume) {
      verified.push({
        skill,
        evidence: extractContextQuote(
          resumeText,
          inResume.index,
          inResume.len,
        ),
      });
    } else if (inResume || skillNames.includes(skill)) {
      listedOnly.push(skill);
    }
  }

  return { verified, listedOnly };
}

function buildPositiveSignals(
  resumeText: string,
  ownershipExamples: string[],
  quantifiedExamples: string[],
): ProfileSignal[] {
  const signals: ProfileSignal[] = [];
  for (const ex of ownershipExamples.slice(0, 2)) {
    signals.push({
      signal: "Demonstrates ownership language",
      evidence: ex.slice(0, 120),
    });
  }
  for (const ex of quantifiedExamples.slice(0, 1)) {
    if (signals.length >= 3) break;
    signals.push({
      signal: "Quantified business impact",
      evidence: ex.slice(0, 120),
    });
  }
  if (signals.length === 0 && resumeText.length > 200) {
    signals.push({
      signal: "Relevant professional background",
      evidence: resumeText.slice(0, 100).replace(/\s+/g, " ") + "…",
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
  const sections = splitResumeSections(resumeText);
  const resumeQuality = analyseResumeSignals(resumeText);
  const experience = parseExperienceEntries(resumeText, sections);
  const education = parseEducationEntries(sections);
  const skillsSection = parseSkillsFromSection(sections);
  const allBullets = experience.flatMap((e) => e.bullets);

  const { verified, listedOnly } = classifySkills(
    resumeText,
    skillsSection,
    allBullets,
  );

  let professional_summary = extractProfessionalSummary(resumeText, sections);
  if (!professional_summary || professional_summary.length < 40) {
    professional_summary = summaryFromRecentRole(experience);
  }

  const career_types_sequence = experience.map((e) => e.company_type);
  const career_pattern =
    career_types_sequence.length > 0
      ? career_types_sequence.join(" → ")
      : "Not available";

  const display_name = filenameToDisplayName(resumeFilename);
  const most_recent_title = experience[0]?.title ?? "Not stated";
  const location = extractLocation(resumeText);
  const total_years_experience = estimateYearsExperience(experience);
  const trajectory_velocity = computeTrajectoryVelocity(experience);

  const title_band = inferTitleBand(most_recent_title);

  return {
    display_name,
    most_recent_title,
    location,
    total_years_experience,
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
      resumeText,
      resumeQuality.ownership.ownership_examples,
      resumeQuality.quantification.quantified_examples,
    ),
    watch_signals: buildWatchSignals(
      resumeQuality.keyword_stuffing.flagged,
      resumeQuality.keyword_stuffing.explanation,
      resumeQuality.ownership.ratio_percent,
    ),
    experience,
    education,
    skills_verified: verified,
    skills_listed_only: listedOnly,
    title_band,
  };
}

function inferTitleBand(title: string): string | null {
  const t = title.toLowerCase();
  if (/\b(?:chief|cto|ceo|vp|vice president|director)\b/.test(t))
    return "Executive";
  if (/\b(?:principal|staff|distinguished)\b/.test(t)) return "Staff+";
  if (/\b(?:senior|sr\.?|lead|manager)\b/.test(t)) return "Senior";
  if (/\b(?:junior|jr\.?|associate|intern)\b/.test(t)) return "Junior";
  return "Mid";
}

/** Re-export for skills — thin helper if semantic-matcher doesn't export findTermInResume */
export function normalizeSignalProfile(
  raw: unknown,
  resumeText: string,
  resumeFilename: string,
): CandidateSignalProfile {
  if (typeof raw === "object" && raw != null && "display_name" in raw) {
    return raw as CandidateSignalProfile;
  }
  return buildSignalProfile(resumeText, resumeFilename);
}
