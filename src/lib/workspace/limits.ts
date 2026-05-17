import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const MVP_JOB_LIMIT_MESSAGE =
  "You have reached the maximum of 3 active jobs on the MVP plan. Please contact us to upgrade.";

export const MVP_CANDIDATE_LIMIT_MESSAGE =
  "You have reached the 1200 candidate limit on the MVP plan. Please contact us to upgrade.";

export type WorkspaceUsage = {
  max_jobs: number;
  max_candidates: number;
  current_job_count: number;
  current_candidate_count: number;
};

export class WorkspaceJobLimitError extends Error {
  readonly code = "JOB_LIMIT_REACHED" as const;

  constructor(message = MVP_JOB_LIMIT_MESSAGE) {
    super(message);
    this.name = "WorkspaceJobLimitError";
  }
}

export class WorkspaceCandidateLimitError extends Error {
  readonly code = "CANDIDATE_LIMIT_REACHED" as const;

  constructor(message = MVP_CANDIDATE_LIMIT_MESSAGE) {
    super(message);
    this.name = "WorkspaceCandidateLimitError";
  }
}

function parseLimitsRow(row: Record<string, unknown>): WorkspaceUsage {
  return {
    max_jobs: Math.max(0, Number(row.max_jobs ?? 3) || 3),
    max_candidates: Math.max(0, Number(row.max_candidates ?? 1200) || 1200),
    current_job_count: Math.max(0, Number(row.current_job_count ?? 0) || 0),
    current_candidate_count: Math.max(
      0,
      Number(row.current_candidate_count ?? 0) || 0,
    ),
  };
}

const LIMIT_COLUMNS =
  "user_id, max_jobs, max_candidates, current_job_count, current_candidate_count";

export async function ensureWorkspaceLimitsRow(
  supabase: SupabaseClient,
  userId: string,
): Promise<WorkspaceUsage> {
  const { data, error } = await supabase
    .from("workspace_settings")
    .select(LIMIT_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (error.message?.toLowerCase().includes("does not exist")) {
      return {
        max_jobs: 3,
        max_candidates: 1200,
        current_job_count: 0,
        current_candidate_count: 0,
      };
    }
    throw new Error(error.message);
  }

  if (data) {
    return parseLimitsRow(data as Record<string, unknown>);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("workspace_settings")
    .upsert(
      {
        user_id: userId,
        settings: {},
        max_jobs: 3,
        max_candidates: 1200,
        current_job_count: 0,
        current_candidate_count: 0,
      },
      { onConflict: "user_id" },
    )
    .select(LIMIT_COLUMNS)
    .single();

  if (insertError) throw new Error(insertError.message);
  return parseLimitsRow(inserted as Record<string, unknown>);
}

export async function getWorkspaceUsage(
  supabase: SupabaseClient,
  userId: string,
): Promise<WorkspaceUsage> {
  return ensureWorkspaceLimitsRow(supabase, userId);
}

export function assertCanCreateJob(usage: WorkspaceUsage): void {
  if (usage.current_job_count >= usage.max_jobs) {
    throw new WorkspaceJobLimitError();
  }
}

export function assertCanCreateCandidate(usage: WorkspaceUsage): void {
  if (usage.current_candidate_count >= usage.max_candidates) {
    throw new WorkspaceCandidateLimitError();
  }
}

export async function incrementJobCount(
  supabase: SupabaseClient,
  userId: string,
  delta = 1,
): Promise<void> {
  const usage = await ensureWorkspaceLimitsRow(supabase, userId);
  const next = Math.max(0, usage.current_job_count + delta);
  const { error } = await supabase
    .from("workspace_settings")
    .update({
      current_job_count: next,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function incrementCandidateCount(
  supabase: SupabaseClient,
  userId: string,
  delta = 1,
): Promise<void> {
  const usage = await ensureWorkspaceLimitsRow(supabase, userId);
  const next = Math.max(0, usage.current_candidate_count + delta);
  const { error } = await supabase
    .from("workspace_settings")
    .update({
      current_candidate_count: next,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

export async function incrementCandidateCountAdmin(
  userId: string,
  delta = 1,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  await incrementCandidateCount(admin, userId, delta);
}

export async function decrementJobCount(
  supabase: SupabaseClient,
  userId: string,
  delta = 1,
): Promise<void> {
  await incrementJobCount(supabase, userId, -delta);
}

export async function decrementCandidateCount(
  supabase: SupabaseClient,
  userId: string,
  delta = 1,
): Promise<void> {
  await incrementCandidateCount(supabase, userId, -delta);
}

export async function decrementCandidateCountAdmin(
  userId: string,
  delta = 1,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  await decrementCandidateCount(admin, userId, delta);
}

export function limitErrorResponse(err: unknown): {
  status: number;
  body: { error: string; code?: string };
} | null {
  if (err instanceof WorkspaceJobLimitError) {
    return {
      status: 403,
      body: { error: err.message, code: err.code },
    };
  }
  if (err instanceof WorkspaceCandidateLimitError) {
    return {
      status: 403,
      body: { error: err.message, code: err.code },
    };
  }
  return null;
}
