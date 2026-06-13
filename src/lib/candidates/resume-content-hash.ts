import { createHash } from "crypto";

/** SHA-256 of the first 10k chars — matches upload duplicate detection. */
export function computeResumeContentHash(resumeText: string): string {
  return createHash("sha256").update(resumeText.slice(0, 10000)).digest("hex");
}

export function hashResumeContentPrefix(resumeText: string): string {
  const prefix = resumeText.trim().slice(0, 500);
  return createHash("sha256").update(prefix).digest("hex");
}
