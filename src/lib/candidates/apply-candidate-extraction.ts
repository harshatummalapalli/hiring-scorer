import type { CandidateSignalProfile } from "@/types/candidate";
import {
  extractCandidateFields,
  type ExtractedCandidateFields,
} from "./extract-resume-fields";
import { splitFullName } from "./parse-resume-identity";
import { sanitizeDisplayNameArtifacts } from "./resolve-display-name";

export type CandidateExtractionPatch = {
  display_name: string;
  application_email: string | null;
  application_phone: string | null;
  linkedin_url: string | null;
  signal_profile: Partial<CandidateSignalProfile>;
};

export function extractAndBuildPatch(
  resumeText: string,
  resumeFilename: string,
  existingProfile?: CandidateSignalProfile,
): { fields: ExtractedCandidateFields; patch: CandidateExtractionPatch } {
  const fields = extractCandidateFields(resumeText, resumeFilename);
  const displayName = sanitizeDisplayNameArtifacts(fields.full_name);
  const identity = splitFullName(displayName);

  const signal_profile: Partial<CandidateSignalProfile> = {
    ...existingProfile,
    display_name: displayName,
    first_name: identity.first_name,
    last_name: identity.last_name,
    current_title: fields.current_title,
    most_recent_title: fields.current_title ?? "",
    current_company: fields.current_company,
    location: fields.location,
    total_years_experience: fields.total_years_experience,
    linkedin_url: fields.linkedin_url,
    extracted_email: fields.extracted_email,
    extracted_phone: fields.extracted_phone,
    experience_years: fields.experience_years,
  };

  return {
    fields,
    patch: {
      display_name: displayName,
      application_email: fields.extracted_email,
      application_phone: fields.extracted_phone,
      linkedin_url: fields.linkedin_url,
      signal_profile,
    },
  };
}
