import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureResumesBucketExists, formatResumeStorageError } from "@/lib/storage/ensure-resumes-bucket";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Supabase Storage bucket: `resumes`
 *
 * One-time setup: run supabase/setup-resumes-storage.sql in the Supabase SQL Editor.
 * That creates the private `resumes` bucket (10 MB, PDF/DOCX/TXT) and storage RLS policies.
 * Alternatively create the bucket in Dashboard → Storage, then run resume-storage-policies.sql.
 *
 * If SUPABASE_SERVICE_ROLE_KEY is set, the app will try to create the bucket on first upload.
 *
 * Service role (`SUPABASE_SERVICE_ROLE_KEY`) is still needed for public job applications
 * and super-admin routes that bypass RLS.
 *
 * Retention: `resume_delete_after` on each candidate marks when the stored file may be
 * removed. A scheduled cleanup job should periodically delete objects in Storage where
 * resume_delete_after < now() and clear resume_file_* columns — that job is not built yet.
 */

export const RESUMES_BUCKET = "resumes";

export const RESUME_MAX_BYTES = 10 * 1024 * 1024;

export const RESUME_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;

export type ResumeMimeType = (typeof RESUME_ALLOWED_MIME_TYPES)[number];

export type StoredResumeMeta = {
  resume_file_path: string;
  resume_file_name: string;
  resume_file_size: number;
  resume_file_type: string;
  resume_stored_at: string;
  resume_delete_after: string;
};

const MIME_BY_EXT: Record<string, ResumeMimeType> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

export function resumeMimeFromFilename(filename: string): ResumeMimeType | null {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? null;
}

export function resumeMimeFromFile(file: File): ResumeMimeType | null {
  const fromType = file.type?.toLowerCase();
  if (
    fromType &&
    RESUME_ALLOWED_MIME_TYPES.includes(fromType as ResumeMimeType)
  ) {
    return fromType as ResumeMimeType;
  }
  return resumeMimeFromFilename(file.name);
}

export function assertResumeFileAllowed(
  file: Pick<File, "name" | "type" | "size">,
): ResumeMimeType {
  if (file.size > RESUME_MAX_BYTES) {
    throw new Error("Resume file exceeds the 10 MB limit.");
  }
  const mime = resumeMimeFromFile(file as File);
  if (!mime) {
    throw new Error("Unsupported file type. Upload PDF, DOCX, or TXT.");
  }
  return mime;
}

/**
 * Supabase Storage object names must be S3-safe (no `[` `]` `#` `%` etc.).
 * Keeps letters, numbers, dot, hyphen, underscore; normalizes the extension.
 */
export function sanitizeResumeFilename(name: string): string {
  const base = name.replace(/[/\\]/g, "_").replace(/\.\./g, ".").trim();
  const lastDot = base.lastIndexOf(".");
  const rawExt = lastDot > 0 ? base.slice(lastDot + 1).toLowerCase() : "";
  const stem = (lastDot > 0 ? base.slice(0, lastDot) : base).trim();

  const safeStem =
    stem
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 180) || "resume";

  const allowedExt = new Set(["pdf", "docx", "txt"]);
  const ext = allowedExt.has(rawExt) ? rawExt : "pdf";
  return `${safeStem}.${ext}`;
}

/** Object path inside bucket: {userId}/{jobId}/{candidateId}/{filename} */
export function buildResumeStoragePath(
  userId: string,
  jobId: string | null,
  candidateId: string,
  filename: string,
): string {
  const jobSegment = jobId?.trim() || "no-job";
  const safeName = sanitizeResumeFilename(filename);
  return `${userId}/${jobSegment}/${candidateId}/${safeName}`;
}

function twelveMonthsFromNow(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

/** Upload using the recruiter's authenticated server session (requires storage RLS policies). */
export async function uploadResumeToStorage(
  supabase: SupabaseClient,
  storagePath: string,
  fileBytes: ArrayBuffer,
  contentType: string,
): Promise<void> {
  await ensureResumesBucketExists();

  const { error } = await supabase.storage
    .from(RESUMES_BUCKET)
    .upload(storagePath, fileBytes, {
      contentType,
      upsert: true,
    });
  if (error) throw new Error(formatResumeStorageError(error.message));
}

/** Upload on behalf of a workspace owner (public apply); requires service role. */
export async function uploadResumeToStorageAsAdmin(
  storagePath: string,
  fileBytes: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage
    .from(RESUMES_BUCKET)
    .upload(storagePath, fileBytes, {
      contentType,
      upsert: true,
    });
  if (error) throw new Error(error.message);
}

export function buildStoredResumeMeta(
  storagePath: string,
  originalFilename: string,
  fileSize: number,
  mimeType: string,
): StoredResumeMeta {
  const now = new Date();
  return {
    resume_file_path: storagePath,
    resume_file_name: originalFilename,
    resume_file_size: fileSize,
    resume_file_type: mimeType,
    resume_stored_at: now.toISOString(),
    resume_delete_after: twelveMonthsFromNow().toISOString(),
  };
}

export async function createSignedResumeUrl(
  supabase: SupabaseClient,
  storagePath: string,
  expiresInSeconds = 60,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(RESUMES_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) throw new Error(error.message);
  if (!data?.signedUrl) throw new Error("Failed to create download URL.");
  return data.signedUrl;
}

export function isMissingResumeStorageColumnError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("resume_file_path") || m.includes("resume_file_name");
}
