import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Workspaces at or above this cap are treated as unlimited in UI and enforcement. */
export const UNLIMITED_WORKSPACE_CAP = 1_000_000;

const UNLIMITED_WORKSPACE_EMAILS = new Set([
  "recruiter.harsha@gmail.com",
]);

export function isUnlimitedWorkspaceCap(max: number): boolean {
  return max >= UNLIMITED_WORKSPACE_CAP;
}

export function hasUnlimitedWorkspaceEmail(
  email: string | null | undefined,
): boolean {
  const normalized = email?.trim().toLowerCase();
  return normalized ? UNLIMITED_WORKSPACE_EMAILS.has(normalized) : false;
}

async function isWorkspaceUnlimited(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", userId)
      .maybeSingle();
    if (profile?.is_super_admin === true) return true;
  } catch {
    /* profiles column may be missing in some envs */
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id === userId && hasUnlimitedWorkspaceEmail(user.email)) {
      return true;
    }
  } catch {
    /* ignore */
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (!error && hasUnlimitedWorkspaceEmail(data.user?.email)) {
      return true;
    }
  } catch {
    /* service role required */
  }

  return false;
}

function applyUnlimitedCaps(usage: WorkspaceUsage): WorkspaceUsage {
  return {
    ...usage,
    max_jobs: UNLIMITED_WORKSPACE_CAP,
    max_candidates: UNLIMITED_WORKSPACE_CAP,
  };
}

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
  const unlimited = await isWorkspaceUnlimited(supabase, userId);
  const defaultJobs = unlimited ? UNLIMITED_WORKSPACE_CAP : 3;
  const defaultCandidates = unlimited ? UNLIMITED_WORKSPACE_CAP : 1200;

  const { data, error } = await supabase
    .from("workspace_settings")
    .select(LIMIT_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (error.message?.toLowerCase().includes("does not exist")) {
      const usage = {
        max_jobs: unlimited ? UNLIMITED_WORKSPACE_CAP : 3,
        max_candidates: unlimited ? UNLIMITED_WORKSPACE_CAP : 1200,
        current_job_count: 0,
        current_candidate_count: 0,
      };
      return unlimited ? applyUnlimitedCaps(usage) : usage;
    }
    throw new Error(error.message);
  }

  if (data) {
    const usage = parseLimitsRow(data as Record<string, unknown>);
    return unlimited ? applyUnlimitedCaps(usage) : usage;
  }

  const maxJobs = defaultJobs;
  const maxCandidates = defaultCandidates;

  const { data: inserted, error: insertError } = await supabase
    .from("workspace_settings")
    .upsert(
      {
        user_id: userId,
        settings: {},
        max_jobs: maxJobs,
        max_candidates: maxCandidates,
        current_job_count: 0,
        current_candidate_count: 0,
      },
      { onConflict: "user_id" },
    )
    .select(LIMIT_COLUMNS)
    .single();

  if (insertError) throw new Error(insertError.message);
  const usage = parseLimitsRow(inserted as Record<string, unknown>);
  return unlimited ? applyUnlimitedCaps(usage) : usage;
}

export async function getWorkspaceUsage(
  supabase: SupabaseClient,
  userId: string,
): Promise<WorkspaceUsage> {
  const usage = await ensureWorkspaceLimitsRow(supabase, userId);
  if (await isWorkspaceUnlimited(supabase, userId)) {
    return applyUnlimitedCaps(usage);
  }
  return usage;
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
