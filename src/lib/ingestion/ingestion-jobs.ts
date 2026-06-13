import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type IngestionJobStatus =
  | "pending"
  | "processing"
  | "complete"
  | "failed";

export type CandidateIngestionJob = {
  id: string;
  candidate_id: string;
  job_id: string | null;
  owner_user_id: string;
  status: IngestionJobStatus;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
};

export async function getLatestIngestionJob(
  candidateId: string,
): Promise<CandidateIngestionJob | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("candidate_ingestion_jobs")
      .select(
        "id, candidate_id, job_id, owner_user_id, status, attempts, max_attempts, last_error",
      )
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data as CandidateIngestionJob;
  } catch {
    return null;
  }
}

export async function markIngestionJobProcessing(
  jobId: string,
  attempts: number,
): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("candidate_ingestion_jobs")
      .update({
        status: "processing",
        attempts,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    if (error) {
      console.warn(
        "[ingestion-jobs] processing update failed:",
        error.message,
      );
    }
  } catch (err) {
    console.warn(
      "[ingestion-jobs] processing update failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function markIngestionJobComplete(jobId: string): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("candidate_ingestion_jobs")
      .update({
        status: "complete",
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    if (error) {
      console.warn("[ingestion-jobs] complete update failed:", error.message);
    }
  } catch (err) {
    console.warn(
      "[ingestion-jobs] complete update failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function resetIngestionJobForRetry(
  candidateId: string,
): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("candidate_ingestion_jobs")
      .update({
        status: "pending",
        attempts: 0,
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("candidate_id", candidateId);
    if (error) {
      console.warn(
        "[ingestion-jobs] retry reset failed:",
        error.message,
      );
    }
  } catch (err) {
    console.warn(
      "[ingestion-jobs] retry reset failed:",
      err instanceof Error ? err.message : err,
    );
  }
}

export async function markIngestionJobFailed(
  jobId: string,
  lastError: string,
): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("candidate_ingestion_jobs")
      .update({
        status: "failed",
        last_error: lastError.slice(0, 2000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    if (error) {
      console.warn("[ingestion-jobs] failed update failed:", error.message);
    }
  } catch (err) {
    console.warn(
      "[ingestion-jobs] failed update failed:",
      err instanceof Error ? err.message : err,
    );
  }
}
