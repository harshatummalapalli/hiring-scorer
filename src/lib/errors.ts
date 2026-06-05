import type { PostgrestError } from "@supabase/supabase-js";
import { sanitizeAiErrorMessage } from "@/lib/errors/sanitize-ai-error-message";

export function isPostgrestError(err: unknown): err is PostgrestError {
  return (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as PostgrestError).message === "string"
  );
}

export function getErrorMessage(err: unknown, fallback: string): string {
  if (isPostgrestError(err)) {
    const parts = [err.message, err.details, err.hint].filter(Boolean);
    return parts.join(" — ") || fallback;
  }
  if (err instanceof Error && err.message) {
    return sanitizeAiErrorMessage(err.message);
  }
  return fallback;
}
