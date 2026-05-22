import { extractAndBuildPatch } from "./apply-candidate-extraction";
import { buildSignalProfile } from "./build-signal-profile";
import { normalizeResumeText } from "@/lib/resume/normalize-resume-text";
import { ingestResumeFromText } from "@/lib/ingestion/ingest-resume";
import { persistResumeIntelligence } from "@/lib/ingestion/persist-intelligence";
import { downloadResumeFromStorage } from "@/lib/storage/resumes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CandidateRow } from "@/types/candidate";

export type ReparsedCandidateUpdate = {
  id: string;
  display_name: string;
  resume_text: string;
  signal_profile: CandidateRow["signal_profile"];
  application_email: string | null;
  application_phone: string | null;
  linkedin_url: string | null;
  structured_resume?: CandidateRow["structured_resume"];
  parse_confidence?: number | null;
  ingestion_errors?: string[];
};

export async function reparseCandidateRecord(
  row: Pick<
    CandidateRow,
    | "id"
    | "resume_text"
    | "resume_filename"
    | "signal_profile"
    | "resume_file_path"
    | "structured_resume"
  >,
): Promise<ReparsedCandidateUpdate> {
  const filename = row.resume_filename ?? "candidate.pdf";
  let resumeText = normalizeResumeText(row.resume_text);
  const oldSnapshot = (row.structured_resume ??
    row.signal_profile) as Record<string, unknown> | null;

  if (row.resume_file_path?.trim()) {
    try {
      const admin = createSupabaseAdminClient();
      const bytes = await downloadResumeFromStorage(admin, row.resume_file_path);
      const { ingestResumeFromBytes } = await import("@/lib/ingestion/ingest-resume");
      const ingested = await ingestResumeFromBytes(
        bytes,
        filename,
        undefined,
        resumeText,
      );
      resumeText = ingested.resumeText || resumeText;
      const { patch } = extractAndBuildPatch(
        resumeText,
        filename,
        ingested.signalProfile,
      );
      const mergedProfile = {
        ...ingested.signalProfile,
        ...patch.signal_profile,
        display_name: patch.display_name,
      };

      let ingestion_errors: string[] | undefined;
      if (ingested.structuredResume) {
        const persisted = await persistResumeIntelligence({
          candidateId: row.id,
          structuredResume: ingested.structuredResume,
          parseResult: ingested.parseResult,
          oldSnapshot,
        });
        if (persisted.errors.length) ingestion_errors = persisted.errors;
      }

      return {
        id: row.id,
        display_name: patch.display_name,
        resume_text: resumeText,
        signal_profile: mergedProfile,
        application_email: patch.application_email,
        application_phone: patch.application_phone,
        linkedin_url: patch.linkedin_url,
        structured_resume: ingested.structuredResume ?? undefined,
        parse_confidence: ingested.structuredResume?.metadata.parse_confidence,
        ingestion_errors,
      };
    } catch (err) {
      console.error(
        "[reparse] Parser failed for candidate",
        row.id,
        err instanceof Error ? err.message : err,
      );
      const existingProfile = row.signal_profile as Record<string, unknown>;
      return {
        id: row.id,
        display_name:
          (typeof existingProfile?.display_name === "string"
            ? existingProfile.display_name
            : null) ?? "Unknown",
        resume_text: resumeText,
        signal_profile: row.signal_profile,
        application_email: null,
        application_phone: null,
        linkedin_url: null,
        ingestion_errors: [
          err instanceof Error ? err.message : "Parser failed",
        ],
      };
    }
  }

  let ingested;
  try {
    ingested = await ingestResumeFromText(resumeText, filename);
  } catch (err) {
    console.error(
      "[reparse] Parser failed for candidate",
      row.id,
      err instanceof Error ? err.message : err,
    );
    const existingProfile = row.signal_profile as Record<string, unknown>;
    return {
      id: row.id,
      display_name:
        (typeof existingProfile?.display_name === "string"
          ? existingProfile.display_name
          : null) ?? "Unknown",
      resume_text: resumeText,
      signal_profile: row.signal_profile,
      application_email: null,
      application_phone: null,
      linkedin_url: null,
      ingestion_errors: [
        err instanceof Error ? err.message : "Parser failed",
      ],
    };
  }
  const { patch } = extractAndBuildPatch(
    resumeText,
    filename,
    ingested.signalProfile,
  );
  const mergedProfile = {
    ...ingested.signalProfile,
    ...patch.signal_profile,
    display_name: patch.display_name,
  };

  let ingestion_errors: string[] | undefined;
  if (ingested.structuredResume) {
    const persisted = await persistResumeIntelligence({
      candidateId: row.id,
      structuredResume: ingested.structuredResume,
      parseResult: ingested.parseResult,
      oldSnapshot,
    });
    if (persisted.errors.length) ingestion_errors = persisted.errors;
  }

  return {
    id: row.id,
    display_name: patch.display_name,
    resume_text: ingested.resumeText,
    signal_profile: mergedProfile,
    application_email: patch.application_email,
    application_phone: patch.application_phone,
    linkedin_url: patch.linkedin_url,
    structured_resume: ingested.structuredResume ?? undefined,
    parse_confidence: ingested.structuredResume?.metadata.parse_confidence,
    ingestion_errors,
  };
}

/** Sync fallback when parser service is unavailable (tests / offline). */
export function reparseCandidateRecordSync(
  row: Pick<CandidateRow, "id" | "resume_text" | "resume_filename" | "signal_profile">,
): ReparsedCandidateUpdate {
  const resumeText = normalizeResumeText(row.resume_text);
  const filename = row.resume_filename ?? "candidate.pdf";
  const signal_profile = buildSignalProfile(resumeText, filename);
  const { patch } = extractAndBuildPatch(resumeText, filename, signal_profile);
  const mergedProfile = {
    ...signal_profile,
    ...patch.signal_profile,
    display_name: patch.display_name,
  };
  return {
    id: row.id,
    display_name: patch.display_name,
    resume_text: resumeText,
    signal_profile: mergedProfile,
    application_email: patch.application_email,
    application_phone: patch.application_phone,
    linkedin_url: patch.linkedin_url,
  };
}
