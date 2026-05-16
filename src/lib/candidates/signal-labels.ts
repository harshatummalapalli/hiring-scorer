import type { SignalRating } from "@/types/candidate";
import type { TrajectoryVelocity } from "@/types/candidate";

export function ownershipLabel(ratioPercent: number): SignalRating {
  if (ratioPercent > 65) return "Strong";
  if (ratioPercent >= 35) return "Moderate";
  return "Weak";
}

export function quantificationLabel(
  ratioPercent: number,
  level: "consistent" | "sometimes" | "rarely",
): SignalRating {
  if (level === "consistent" || ratioPercent > 65) return "Strong";
  if (level === "sometimes" || ratioPercent >= 35) return "Moderate";
  return "Weak";
}

export function trajectoryLabel(
  velocity: TrajectoryVelocity,
): "Fast" | "Normal" | "Slow" {
  switch (velocity) {
    case "fast":
      return "Fast";
    case "slow":
      return "Slow";
    default:
      return "Normal";
  }
}

export function trajectoryBarPercent(velocity: TrajectoryVelocity): number {
  switch (velocity) {
    case "fast":
      return 85;
    case "slow":
      return 30;
    default:
      return 55;
  }
}
