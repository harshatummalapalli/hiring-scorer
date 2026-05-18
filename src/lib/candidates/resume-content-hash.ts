import { createHash } from "crypto";

export function hashResumeContentPrefix(resumeText: string): string {
  const prefix = resumeText.trim().slice(0, 500);
  return createHash("sha256").update(prefix).digest("hex");
}
