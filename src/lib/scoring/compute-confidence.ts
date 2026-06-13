import type { CandidateSignalProfile } from "@/types/candidate";
import type {
  CandidateScoreResult,
  ConfidenceLevel,
  ConfidenceResult,
} from "@/types/score";

export type { ConfidenceLevel, ConfidenceResult };

function estimateWordCount(profile: CandidateSignalProfile): number {
  const chunks: string[] = [];
  if (profile.professional_summary?.trim()) {
    chunks.push(profile.professional_summary);
  }
  for (const role of profile.experience ?? []) {
    for (const bullet of role.bullets ?? []) {
      if (bullet?.trim()) chunks.push(bullet);
    }
  }
  if (profile.experience_fallback_raw?.trim()) {
    chunks.push(profile.experience_fallback_raw);
  }
  return chunks.join(" ").split(/\s+/).filter(Boolean).length;
}

function countVerifiedDimensionQuotes(
  scoreSnapshot: CandidateScoreResult,
): number {
  let count = 0;

  for (const dimension of scoreSnapshot.dimension_consensus ?? []) {
    const flag = dimension.model_details?.gpt4o?.dimension_flag ?? "";
    const quote = flag.startsWith("Quote:")
      ? flag.replace(/^Quote:\s*/, "").trim()
      : "";
    if (quote.length > 10) count += 1;
  }

  if (count > 0) return count;

  const dimensions = scoreSnapshot.dimension_scores ?? {};
  for (const row of Object.values(dimensions)) {
    const extended = row as { quote?: string; supporting_quote?: string };
    const quote = extended.quote ?? extended.supporting_quote ?? "";
    if (quote.trim().length > 10) count += 1;
  }

  return count;
}

const NEUTRAL: ConfidenceResult = {
  level: "medium",
  score: 50,
  factors: { positive: [], limiting: [] },
};

export function computeConfidence(
  signalProfile: CandidateSignalProfile | null | undefined,
  scoreSnapshot: CandidateScoreResult | null | undefined,
): ConfidenceResult {
  try {
    if (!signalProfile || !scoreSnapshot) return NEUTRAL;

    let score = 50;
    const positive: string[] = [];
    const limiting: string[] = [];

    const wordCount = estimateWordCount(signalProfile);
    if (wordCount > 400) {
      score += 10;
      positive.push("Detailed resume");
    } else if (wordCount < 150) {
      score -= 15;
      limiting.push("Very short resume");
    }

    const verifiedSkills = signalProfile.skills_verified?.length ?? 0;
    const listedSkills = signalProfile.skills_listed_only?.length ?? 0;
    if (verifiedSkills >= 5) {
      score += 12;
      positive.push(
        `${verifiedSkills} skills demonstrated in work history`,
      );
    } else if (verifiedSkills === 0 && listedSkills > 0) {
      score -= 10;
      limiting.push(
        "Skills listed only — none demonstrated in work history",
      );
    }

    const ownershipRatio =
      (signalProfile.ownership_ratio_percent ??
        signalProfile.resume_quality?.ownership?.ratio_percent ??
        0) / 100;
    if (ownershipRatio > 0.4) {
      score += 8;
      positive.push("Strong ownership language");
    } else if (ownershipRatio < 0.1) {
      score -= 8;
      limiting.push("Weak ownership language");
    }

    const quantRatio =
      (signalProfile.quantification_ratio_percent ??
        signalProfile.resume_quality?.quantification?.ratio_percent ??
        0) / 100;
    if (quantRatio > 0.3) {
      score += 8;
      positive.push("Claims supported by numbers");
    } else if (quantRatio < 0.1) {
      score -= 5;
      limiting.push("Few quantified achievements");
    }

    const workHistory = signalProfile.experience ?? [];
    const datedRoles = workHistory.filter(
      (role) => role.start_date && role.end_date,
    ).length;
    const undatedRoles = workHistory.length - datedRoles;
    if (undatedRoles > 1) {
      score -= 10;
      limiting.push(`${undatedRoles} roles missing employment dates`);
    } else if (workHistory.length >= 2 && undatedRoles === 0) {
      score += 5;
      positive.push("Complete employment history");
    }

    const verifiedQuotes = countVerifiedDimensionQuotes(scoreSnapshot);
    if (verifiedQuotes >= 4) {
      score += 10;
      positive.push(
        `${verifiedQuotes}/5 dimensions have verified evidence`,
      );
    } else if (verifiedQuotes <= 1) {
      score -= 12;
      limiting.push("Limited verified evidence in resume text");
    }

    if (signalProfile.keyword_stuffing_flagged) {
      score -= 15;
      limiting.push("Possible skill inflation detected");
    }

    score = Math.max(0, Math.min(100, score));

    const level: ConfidenceLevel =
      score >= 70 ? "high" : score >= 40 ? "medium" : "low";

    return { level, score, factors: { positive, limiting } };
  } catch {
    return NEUTRAL;
  }
}
