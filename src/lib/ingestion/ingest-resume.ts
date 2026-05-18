import { buildSignalProfile } from "@/lib/candidates/build-signal-profile";
import { normalizeResumeText } from "@/lib/resume/normalize-resume-text";
import type { CandidateSignalProfile } from "@/types/candidate";
import type { ParseRunResult, StructuredResume } from "@/types/structured-resume";
import {
  isResumeParserConfigured,
  parseResumeFile,
  parseResumeText,
} from "./parser-client";
import { structuredResumeToSignalProfile } from "./structured-to-signal-profile";

export type IngestResumeResult = {
  resumeText: string;
  signalProfile: CandidateSignalProfile;
  structuredResume: StructuredResume | null;
  parseResult: ParseRunResult | null;
  ingestionSource: "parser_service" | "legacy_typescript";
};

export async function ingestResumeFromBytes(
  bytes: ArrayBuffer,
  filename: string,
  mimeType?: string,
  fallbackText?: string,
): Promise<IngestResumeResult> {
  if (isResumeParserConfigured()) {
    const parseResult = await parseResumeFile(bytes, filename, mimeType);
    if (parseResult?.success && parseResult.structured_resume) {
      const structured = parseResult.structured_resume;
      const resumeText = normalizeResumeText(
        structured.pii_stripped_text || structured.raw_text,
      );
      const signalProfile = structuredResumeToSignalProfile(structured, filename);
      return {
        resumeText,
        signalProfile,
        structuredResume: structured,
        parseResult,
        ingestionSource: "parser_service",
      };
    }
  }

  const resumeText = normalizeResumeText(fallbackText ?? "");
  const signalProfile = buildSignalProfile(resumeText, filename);
  return {
    resumeText,
    signalProfile,
    structuredResume: null,
    parseResult: null,
    ingestionSource: "legacy_typescript",
  };
}

export async function ingestResumeFromText(
  text: string,
  filename: string,
): Promise<IngestResumeResult> {
  const normalized = normalizeResumeText(text);
  if (isResumeParserConfigured()) {
    const parseResult = await parseResumeText(normalized, filename);
    if (parseResult?.success && parseResult.structured_resume) {
      const structured = parseResult.structured_resume;
      const resumeText = normalizeResumeText(
        structured.pii_stripped_text || structured.raw_text,
      );
      return {
        resumeText,
        signalProfile: structuredResumeToSignalProfile(structured, filename),
        structuredResume: structured,
        parseResult,
        ingestionSource: "parser_service",
      };
    }
  }

  return {
    resumeText: normalized,
    signalProfile: buildSignalProfile(normalized, filename),
    structuredResume: null,
    parseResult: null,
    ingestionSource: "legacy_typescript",
  };
}
