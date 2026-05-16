import { stripPII } from "@/lib/resume/strip-pii";
import {
  evidenceContainsRedaction,
  paraphraseSignalEvidence,
  sanitizeEvidenceForDisplay,
} from "./profile-display";

/** Always analyse and quote from PII-stripped resume text. */
export function toStrippedResumeText(resumeText: string): string {
  return stripPII(resumeText).stripped;
}

/** Strip PII from a quote fragment before storing in the signal profile. */
export function prepareSignalQuote(signal: string, rawQuote: string): string {
  const trimmed = rawQuote.trim();
  if (!trimmed) {
    return sanitizeEvidenceForDisplay(signal, "");
  }
  const { stripped } = stripPII(trimmed);
  if (!stripped.trim() || evidenceContainsRedaction(stripped)) {
    return sanitizeEvidenceForDisplay(signal, "");
  }
  return sanitizeEvidenceForDisplay(signal, stripped);
}
