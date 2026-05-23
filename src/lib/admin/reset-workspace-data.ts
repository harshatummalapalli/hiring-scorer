import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { RESUMES_BUCKET } from "@/lib/storage/resumes";

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

export type WorkspaceResetResult = {
  deleted: Record<string, number>;
  storageFilesRemoved: number;
  workspaceLimitsReset: number;
};

function isMissingRelation(error: { message?: string } | null): boolean {
  const msg = error?.message?.toLowerCase() ?? "";
  return (
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}

async function deleteAllFromTable(
  admin: SupabaseClient,
  table: string,
  idColumn = "id",
): Promise<number> {
  const { error, count } = await admin
    .from(table)
    .delete({ count: "exact" })
    .neq(idColumn, NIL_UUID);

  if (error) {
    if (isMissingRelation(error)) return 0;
    throw new Error(`${table}: ${error.message}`);
  }
  return count ?? 0;
}

async function emptyResumesBucket(admin: SupabaseClient): Promise<number> {
  let removed = 0;

  async function walk(prefix: string): Promise<void> {
    const { data, error } = await admin.storage.from(RESUMES_BUCKET).list(prefix, {
      limit: 1000,
    });
    if (error) {
      if (error.message?.toLowerCase().includes("not found")) return;
      throw new Error(`storage list: ${error.message}`);
    }
    if (!data?.length) return;

    const filePaths: string[] = [];
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id == null) {
        await walk(path);
      } else {
        filePaths.push(path);
      }
    }

    if (filePaths.length > 0) {
      const { error: removeError } = await admin.storage
        .from(RESUMES_BUCKET)
        .remove(filePaths);
      if (removeError) {
        throw new Error(`storage remove: ${removeError.message}`);
      }
      removed += filePaths.length;
    }
  }

  await walk("");
  return removed;
}

/**
 * Removes all jobs, candidates, scores, pipeline rows, and email queue data.
 * Does NOT delete auth.users, profiles, or workspace_profiles.
 */
export async function resetAllWorkspaceData(
  admin: SupabaseClient = createSupabaseAdminClient(),
): Promise<WorkspaceResetResult> {
  const deleted: Record<string, number> = {};

  const tablesInOrder = [
    "email_queue",
    "email_ingestion_log",
    "parser_usage_log",
    "activity_log",
    "recruiter_decisions",
    "pipeline_candidates",
    "saved_scores",
    "scoring_runs",
    "candidate_notes",
    "candidate_corrections",
    "candidate_evidence",
    "candidate_skills",
    "candidate_experience",
    "resume_parse_runs",
    "resume_documents",
    "candidates",
    "role_briefs",
  ] as const;

  for (const table of tablesInOrder) {
    deleted[table] = await deleteAllFromTable(admin, table);
  }

  const { data: limitsRows, error: limitsSelectError } = await admin
    .from("workspace_settings")
    .select("user_id");

  if (limitsSelectError && !isMissingRelation(limitsSelectError)) {
    throw new Error(`workspace_settings: ${limitsSelectError.message}`);
  }

  let workspaceLimitsReset = 0;
  if (limitsRows?.length) {
    const { error: limitsUpdateError, count } = await admin
      .from("workspace_settings")
      .update({
        current_job_count: 0,
        current_candidate_count: 0,
        updated_at: new Date().toISOString(),
      })
      .neq("user_id", NIL_UUID);

    if (limitsUpdateError) {
      throw new Error(`workspace_settings reset: ${limitsUpdateError.message}`);
    }
    workspaceLimitsReset = count ?? limitsRows.length;
  }

  const storageFilesRemoved = await emptyResumesBucket(admin);

  return { deleted, storageFilesRemoved, workspaceLimitsReset };
}
