import { formatKartaDate } from "@/lib/dates/format-karta-date";

export type DuplicateMatchLevel =
  | "content_hash"
  | "name_similarity"
  | "email";

export type DuplicateMatch = {
  level: DuplicateMatchLevel;
  candidateId: string;
  displayName: string;
  createdAt: string;
  similarity?: number;
};

export function duplicateWarningMessage(match: DuplicateMatch): string {
  const date = formatKartaDate(match.createdAt);
  switch (match.level) {
    case "content_hash":
      return `This resume appears to already exist as ${match.displayName}, added on ${date}.`;
    case "email":
      return `This email address belongs to ${match.displayName}, who is already in Kharta.`;
    case "name_similarity":
      return `A candidate named ${match.displayName} already exists in your talent pool.`;
    default:
      return `A similar candidate already exists.`;
  }
}
