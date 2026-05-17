type SubmitCandidateOptions = {
  resumeText: string;
  resumeFilename: string;
  resumeFile: File;
  displayName?: string;
  jobId?: string;
  source?: string;
};

export async function submitCandidateWithResume(
  options: SubmitCandidateOptions,
): Promise<Response> {
  const form = new FormData();
  form.append("resumeText", options.resumeText);
  form.append("resumeFilename", options.resumeFilename);
  form.append("resumeFile", options.resumeFile);
  if (options.displayName) form.append("displayName", options.displayName);
  if (options.jobId) form.append("jobId", options.jobId);
  if (options.source) form.append("source", options.source);

  return fetch("/api/candidates", {
    method: "POST",
    body: form,
  });
}
