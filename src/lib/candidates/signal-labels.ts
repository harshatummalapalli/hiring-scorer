import type { TrajectoryVelocity } from "@/types/candidate";

export function ownershipLabel(ownershipCount: number): string {
  if (ownershipCount >= 3) return "Strong";
  if (ownershipCount >= 1) return "Moderate";
  return "Developing";
}

export function impactEvidenceLabel(
  ratioPercent: number,
  level: "consistent" | "sometimes" | "rarely",
): string {
  if (level === "consistent" || ratioPercent > 65) return "Strong";
  if (level === "sometimes" || ratioPercent >= 35) return "Moderate";
  return "Developing";
}

export function careerGrowthLabel(
  velocity: TrajectoryVelocity,
): "Fast" | "Steady" | "Early Stage" {
  switch (velocity) {
    case "fast":
      return "Fast";
    case "slow":
      return "Early Stage";
    default:
      return "Steady";
  }
}

export function careerGrowthBarPercent(velocity: TrajectoryVelocity): number {
  switch (velocity) {
    case "fast":
      return 85;
    case "slow":
      return 25;
    default:
      return 55;
  }
}

export function profileDepthLabel(keywordFlagged: boolean): string {
  return keywordFlagged ? "Surface" : "Deep";
}

export function profileDepthBarPercent(keywordFlagged: boolean): number {
  return keywordFlagged ? 35 : 80;
}

/** @deprecated use impactEvidenceLabel */
export const quantificationLabel = impactEvidenceLabel;
/** @deprecated use careerGrowthLabel */
export const trajectoryLabel = (v: TrajectoryVelocity) =>
  v === "fast" ? "Fast" : v === "slow" ? "Early Stage" : "Steady";
/** @deprecated */
export const trajectoryBarPercent = careerGrowthBarPercent;

// ─── 1-10 score functions ───────────────────

export function ownershipScore(
  ownershipCount: number,
  ownershipRatioPercent: number,
): number {
  if (ownershipRatioPercent >= 75 || ownershipCount >= 5) return 9;
  if (ownershipRatioPercent >= 60 || ownershipCount >= 4) return 8;
  if (ownershipRatioPercent >= 50 || ownershipCount >= 3) return 7;
  if (ownershipRatioPercent >= 40 || ownershipCount >= 2) return 6;
  if (ownershipRatioPercent >= 30 || ownershipCount >= 1) return 5;
  if (ownershipRatioPercent >= 20) return 4;
  if (ownershipRatioPercent >= 10) return 3;
  return 2;
}

export function impactScore(
  ratioPercent: number,
  level: "consistent" | "sometimes" | "rarely",
): number {
  if (level === "consistent" && ratioPercent >= 70) return 9;
  if (level === "consistent" || ratioPercent >= 60) return 8;
  if (ratioPercent >= 50) return 7;
  if (level === "sometimes" || ratioPercent >= 40) return 6;
  if (ratioPercent >= 30) return 5;
  if (ratioPercent >= 20) return 4;
  if (level === "rarely" || ratioPercent >= 10) return 3;
  return 2;
}

export function careerGrowthScore(velocity: TrajectoryVelocity): number {
  switch (velocity) {
    case "fast":
      return 9;
    case "normal":
      return 6;
    case "slow":
      return 3;
    default:
      return 6;
  }
}

export function profileDepthScore(
  keywordFlagged: boolean,
  verifiedSkillCount: number,
  listedOnlyCount: number,
): number {
  if (keywordFlagged) return 2;
  const total = verifiedSkillCount + listedOnlyCount;
  const verifiedRatio = total > 0 ? verifiedSkillCount / total : 0;
  if (verifiedRatio >= 0.8 && verifiedSkillCount >= 5) return 9;
  if (verifiedRatio >= 0.7 || verifiedSkillCount >= 4) return 8;
  if (verifiedRatio >= 0.6 || verifiedSkillCount >= 3) return 7;
  if (verifiedRatio >= 0.5 || verifiedSkillCount >= 2) return 6;
  if (verifiedRatio >= 0.3 || verifiedSkillCount >= 1) return 5;
  return 4;
}

// ─── Why text generators ─────────────────────

export function ownershipWhy(
  score: number,
  ownershipCount: number,
  ratioPercent: number,
): string {
  if (score >= 8)
    return `${ratioPercent}% of work descriptions use first-person ownership language — built, led, designed, launched. Strong signal of individual accountability.`;
  if (score >= 6)
    return `${ratioPercent}% ownership language found across ${ownershipCount} work descriptions. Moderate evidence of direct contribution.`;
  if (score >= 4)
    return `Ownership language appears occasionally (${ratioPercent}%). Much of the profile uses participation language — assisted, supported, contributed to.`;
  return `Most descriptions use team or passive language. Difficult to identify individual contribution from this profile.`;
}

export function impactWhy(
  score: number,
  ratioPercent: number,
  level: "consistent" | "sometimes" | "rarely",
): string {
  if (score >= 8)
    return `${ratioPercent}% of claims are backed by numbers, percentages, or measurable outcomes. Consistently quantified work history.`;
  if (score >= 6)
    return `Quantified outcomes appear in ${ratioPercent}% of descriptions. Some strong evidence, some vague claims.`;
  if (score >= 4)
    return `Quantification is ${level} — found in roughly ${ratioPercent}% of descriptions. Most claims are activity-based without measurable results.`;
  return `Very few quantified outcomes. Descriptions focus on activities and responsibilities rather than impact.`;
}

export function careerGrowthWhy(
  score: number,
  velocity: TrajectoryVelocity,
): string {
  void score;
  switch (velocity) {
    case "fast":
      return "Career progression is faster than typical market pace — titles, scope, and responsibility have accelerated beyond what years of experience alone would predict.";
    case "normal":
      return "Career progression follows a steady, market-typical pace — consistent advancement without unusual acceleration or stagnation.";
    case "slow":
      return "Progression is slower than typical for this experience level — limited evidence of scope expansion or title advancement across roles.";
    default:
      return "Career progression follows a steady, market-typical pace — consistent advancement without unusual acceleration or stagnation.";
  }
}

export function profileDepthWhy(
  score: number,
  keywordFlagged: boolean,
  verifiedSkillCount: number,
  listedOnlyCount: number,
): string {
  if (keywordFlagged)
    return `Keyword stuffing detected — many skills are listed in a skills section without appearing in work descriptions. This significantly reduces the signal value of listed skills.`;
  const total = verifiedSkillCount + listedOnlyCount;
  if (score >= 8)
    return `${verifiedSkillCount} of ${total} skills appear directly in work descriptions with context. High confidence these are genuinely practised skills.`;
  if (score >= 6)
    return `${verifiedSkillCount} skills verified in work descriptions, ${listedOnlyCount} listed only. Reasonable depth with some skills needing verification.`;
  if (score >= 4)
    return `More skills are listed than verified in context. ${verifiedSkillCount} appear in work descriptions; ${listedOnlyCount} are skills-section only.`;
  return `Most skills are listed without appearing in work descriptions. Cannot verify depth of experience from the profile text.`;
}
