import type { RoleBrief } from "@/types/role-brief";

export type JobStatus = "active" | "paused" | "filled";

export type AutoScoreMode = "needs_scoring" | "auto" | "manual";

export type CandidateSource =
  | "uploaded"
  | "application"
  | "linkedin_profile"
  | string;

export type CandidateScoringStatus =
  | "unscored"
  | "needs_scoring"
  | "scored"
  | "low_relevance"
  | "skipped"
  | "manually_rejected";

export type JobFields = {
  application_token: string | null;
  apply_link: string | null;
  company_name: string | null;
  application_active: boolean;
  application_count: number;
  auto_score_mode: AutoScoreMode;
  status: JobStatus;
  share_token: string | null;
  share_enabled: boolean;
};

export type Job = RoleBrief & JobFields;

export type JobListStats = {
  applicantCount: number;
  strongMatches: number;
  potentialMatches: number;
};

export type JobListItem = Job & JobListStats & {
  daysSinceCreated: number;
};

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  active: "Active",
  paused: "Paused",
  filled: "Filled",
};

export function parseJobStatus(value: unknown): JobStatus {
  const s = String(value ?? "active").toLowerCase();
  if (s === "paused" || s === "filled") return s;
  return "active";
}

export function parseAutoScoreMode(value: unknown): AutoScoreMode {
  const s = String(value ?? "needs_scoring").toLowerCase();
  if (s === "auto" || s === "manual") return s;
  return "needs_scoring";
}

export function parseScoringStatus(value: unknown): CandidateScoringStatus {
  const s = String(value ?? "unscored").toLowerCase();
  if (
    s === "scored" ||
    s === "needs_scoring" ||
    s === "low_relevance" ||
    s === "unlikely_fit" ||
    s === "skipped" ||
    s === "manually_rejected"
  ) {
    if (s === "unlikely_fit") return "low_relevance";
    return s as CandidateScoringStatus;
  }
  return "unscored";
}

export function isUnlikelyFitStatus(status: CandidateScoringStatus): boolean {
  return status === "low_relevance" || status === "manually_rejected";
}

export function parseCandidateSource(value: unknown): CandidateSource {
  const s = String(value ?? "uploaded").trim();
  return s || "uploaded";
}

export function sourceBadgeLabel(source: CandidateSource): string {
  switch (source) {
    case "application":
      return "Application";
    case "linkedin_profile":
      return "LinkedIn Profile";
    case "uploaded":
      return "Uploaded";
    default:
      return source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
