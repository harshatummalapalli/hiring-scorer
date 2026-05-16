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
