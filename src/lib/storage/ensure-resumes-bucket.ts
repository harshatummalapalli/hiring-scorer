import { createClient } from "@supabase/supabase-js";
import {
  RESUME_ALLOWED_MIME_TYPES,
  RESUME_MAX_BYTES,
  RESUMES_BUCKET,
} from "@/lib/storage/resumes";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/supabase/env";

let bucketEnsureAttempted = false;

/** Create the resumes bucket via service role when configured (e.g. first upload on Vercel). */
export async function ensureResumesBucketExists(): Promise<void> {
  if (bucketEnsureAttempted) return;
  bucketEnsureAttempted = true;

  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey().trim();
  if (!url.startsWith("https://") || !key || key.includes("your_")) {
    return;
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existing } = await admin.storage.getBucket(RESUMES_BUCKET);
  if (existing) return;

  const { error } = await admin.storage.createBucket(RESUMES_BUCKET, {
    public: false,
    fileSizeLimit: RESUME_MAX_BYTES,
    allowedMimeTypes: [...RESUME_ALLOWED_MIME_TYPES],
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already exists") || msg.includes("duplicate")) {
      return;
    }
    throw new Error(error.message);
  }
}

export function formatResumeStorageError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid key") || m.includes("invalid object")) {
    return (
      "The resume filename contained characters that storage does not allow. " +
      "The file was renamed automatically on retry — please upload again."
    );
  }
  if (m.includes("bucket not found") || m.includes("does not exist")) {
    return (
      "The resumes storage bucket is missing. In Supabase SQL Editor, run " +
      "supabase/setup-resumes-storage.sql (or create a private bucket named resumes in Storage)."
    );
  }
  if (m.includes("row-level security") || m.includes("policy")) {
    return (
      `${message} Run supabase/setup-resumes-storage.sql in the Supabase SQL Editor.`
    );
  }
  return message;
}
