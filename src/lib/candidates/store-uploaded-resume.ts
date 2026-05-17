import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertResumeFileAllowed,
  buildResumeStoragePath,
  buildStoredResumeMeta,
  uploadResumeToStorage,
} from "@/lib/storage/resumes";
import { updateCandidateResumeStorage } from "@/lib/supabase/candidates";

export async function storeUploadedResumeForCandidate(
  supabase: SupabaseClient,
  userId: string,
  candidateId: string,
  jobId: string | null,
  file: File,
): Promise<void> {
  const mimeType = assertResumeFileAllowed(file);
  const bytes = await file.arrayBuffer();
  const storagePath = buildResumeStoragePath(
    userId,
    jobId,
    candidateId,
    file.name,
  );

  await uploadResumeToStorage(supabase, storagePath, bytes, mimeType);

  const meta = buildStoredResumeMeta(
    storagePath,
    file.name,
    file.size,
    mimeType,
  );

  await updateCandidateResumeStorage(candidateId, meta);
}
