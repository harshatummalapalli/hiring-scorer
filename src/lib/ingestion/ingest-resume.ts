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
  ingestionSource: "parser_service";
};

export async function ingestResumeFromBytes(
  bytes: ArrayBuffer,
  filename: string,
  mimeType?: string,
  _fallbackText?: string,
): Promise<IngestResumeResult> {
  if (!isResumeParserConfigured()) {
    throw new Error(
      "Resume parser service is not configured. " +
        "Set RESUME_PARSER_URL environment variable.",
    );
  }

  const parseResult = await parseResumeFile(bytes, filename, mimeType);

  if (!parseResult) {
    throw new Error(
      "Parser service did not respond. " +
        "Check RESUME_PARSER_URL and PARSER_SECRET_KEY.",
    );
  }

  if (!parseResult.success || !parseResult.structured_resume) {
    console.error(
      "[ingest] Parser returned failure:",
      parseResult.error,
      "Warnings:",
      parseResult.warnings,
    );
    throw new Error(
      `Parser failed: ${parseResult.error ?? "Unknown error"}. ` +
        `Warnings: ${parseResult.warnings.join(", ")}`,
    );
  }

  const structured = parseResult.structured_resume;
  const resumeText = normalizeResumeText(
    structured.pii_stripped_text || structured.raw_text,
  );
  const signalProfile = structuredResumeToSignalProfile(structured, filename);

  console.log("[ingest] ingestionSource: parser_service");

  return {
    resumeText,
    signalProfile,
    structuredResume: structured,
    parseResult,
    ingestionSource: "parser_service",
  };
}

export async function ingestResumeFromText(
  text: string,
  filename: string,
): Promise<IngestResumeResult> {
  const normalized = normalizeResumeText(text);

  if (!isResumeParserConfigured()) {
    throw new Error("Resume parser service is not configured.");
  }

  const parseResult = await parseResumeText(normalized, filename);

  if (!parseResult?.success || !parseResult.structured_resume) {
    console.error(
      "[ingest] Parser returned failure:",
      parseResult?.error,
      "Warnings:",
      parseResult?.warnings,
    );
    throw new Error(
      `Parser failed: ${parseResult?.error ?? "No response"}`,
    );
  }

  const structured = parseResult.structured_resume;
  const resumeText = normalizeResumeText(
    structured.pii_stripped_text || structured.raw_text,
  );

  console.log("[ingest] ingestionSource: parser_service");

  return {
    resumeText,
    signalProfile: structuredResumeToSignalProfile(structured, filename),
    structuredResume: structured,
    parseResult,
    ingestionSource: "parser_service",
  };
}
