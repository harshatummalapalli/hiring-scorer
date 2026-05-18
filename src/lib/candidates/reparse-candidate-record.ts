import { buildSignalProfile } from "./build-signal-profile";
import { extractAndBuildPatch } from "./apply-candidate-extraction";
import { normalizeResumeText } from "@/lib/resume/normalize-resume-text";
import type { CandidateRow } from "@/types/candidate";

export type ReparsedCandidateUpdate = {
  id: string;
  display_name: string;
  resume_text: string;
  signal_profile: CandidateRow["signal_profile"];
  application_email: string | null;
  application_phone: string | null;
  linkedin_url: string | null;
};

export function reparseCandidateRecord(
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
