export const RESUME_FILE_ACCEPT = ".pdf,.doc,.docx,.txt";

export const ACCEPTED_TYPES = [".pdf", ".docx", ".doc", ".txt"] as const;
export const MAX_SIZE_MB = 10;
export const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const ACCEPTED_EXTENSIONS = ACCEPTED_TYPES;

export function isAcceptedResumeFile(file: File): boolean {
  const name = file.name.toLowerCase().trim();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export function validateResumeUpload(file: File): string | null {
  const fileExtension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  if (
    !ACCEPTED_TYPES.includes(
      fileExtension as (typeof ACCEPTED_TYPES)[number],
    )
  ) {
    return "Please upload a PDF, Word document (.docx), or text file.";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `File is too large. Maximum size is ${MAX_SIZE_MB}MB.`;
  }
  return null;
}
export function filterResumeFiles(files: Iterable<File>): File[] {
  return Array.from(files).filter(isAcceptedResumeFile);
}

export function filesToFileList(files: File[]): FileList {
  const dt = new DataTransfer();
  for (const file of files) {
    dt.items.add(file);
  }
  return dt.files;
}
