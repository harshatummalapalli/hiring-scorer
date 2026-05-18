import { extractFullNameFromResume, extractEmailFromResumeText } from "./extract-resume-fields";
import { cleanDisplayName } from "./resolve-display-name";

export type ParsedIdentity = {
  first_name: string;
  last_name: string;
  display_name: string;
};

export function splitFullName(fullName: string): ParsedIdentity {
  const cleaned = cleanDisplayName(fullName.trim());
  if (!cleaned) {
    return { first_name: "Candidate", last_name: "", display_name: "Candidate" };
  }
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return {
      first_name: parts[0],
      last_name: "",
      display_name: cleaned,
    };
  }
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
    display_name: cleaned,
  };
}

export function parseResumeIdentity(
  resumeText: string,
  resumeFilename: string,
): ParsedIdentity {
  const email = extractEmailFromResumeText(resumeText);
  return splitFullName(
    extractFullNameFromResume(resumeText, resumeFilename, email),
  );
}
