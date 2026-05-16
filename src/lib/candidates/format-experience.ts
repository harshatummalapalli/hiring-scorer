import type { ExperienceEntry } from "@/types/candidate";
import { roleDurationMonths } from "./parse-resume-structure";

export function formatExperienceDateRange(
  start: string | null,
  end: string | null,
): string {
  const s = start?.trim() ?? "";
  const e = end?.trim() ?? "";
  if (!s && !e) return "";
  if (s && e) return `${s} – ${e}`;
  return s || e;
}

export function formatExperienceDuration(
  start: string | null,
  end: string | null,
): string | null {
  const months = roleDurationMonths(start, end);
  if (months <= 0) return null;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years > 0 && rem > 0) return `${years} yr${years > 1 ? "s" : ""} ${rem} mo`;
  if (years > 0) return `${years} yr${years > 1 ? "s" : ""}`;
  return `${rem} mo`;
}

export function formatExperienceMeta(job: ExperienceEntry): string {
  const range = formatExperienceDateRange(job.start_date, job.end_date);
  const duration = formatExperienceDuration(job.start_date, job.end_date);
  const parts = [range, duration, job.location?.trim()].filter(Boolean);
  return parts.join(" · ");
}
