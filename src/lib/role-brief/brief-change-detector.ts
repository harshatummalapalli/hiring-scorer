import type { RoleBrief } from "@/types/role-brief";
import { computeBriefContentHash } from "@/lib/role-brief/jd-cache";

export type BriefChangeType =
  | "weights_only"
  | "content_change"
  | "no_change";

type BriefChangeFields = Pick<
  RoleBrief,
  | "deal_breakers"
  | "core_signals"
  | "weight_skills"
  | "weight_trajectory"
  | "weight_domain"
  | "weight_seniority"
  | "weight_tenure"
>;

export function detectBriefChangeType(
  previous: BriefChangeFields,
  next: BriefChangeFields,
): BriefChangeType {
  const prevHash = computeBriefContentHash(previous);
  const nextHash = computeBriefContentHash(next);
  const contentChanged = prevHash !== nextHash;

  const weightsChanged =
    previous.weight_skills !== next.weight_skills ||
    previous.weight_trajectory !== next.weight_trajectory ||
    previous.weight_domain !== next.weight_domain ||
    previous.weight_seniority !== next.weight_seniority ||
    previous.weight_tenure !== next.weight_tenure;

  if (!contentChanged && !weightsChanged) return "no_change";
  if (!contentChanged && weightsChanged) return "weights_only";
  return "content_change";
}
