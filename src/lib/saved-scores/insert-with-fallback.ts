import { insertSavedScore } from "@/lib/supabase/server";

const SNAPSHOT_KEYS = ["score_snapshot", "role_brief_snapshot"] as const;

export function stripSnapshotColumns(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const row = { ...payload };
  for (const key of SNAPSHOT_KEYS) {
    delete row[key];
  }
  return row;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isMissingSnapshotColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("schema cache") ||
    lower.includes("could not find") ||
    lower.includes("score_snapshot") ||
    lower.includes("role_brief_snapshot")
  );
}

function isRoleBriefFkError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("foreign key") ||
    lower.includes("violates") ||
    (lower.includes("role_brief") && lower.includes("saved_scores"))
  );
}

/** Insert saved_scores; omit snapshot columns or role_brief_id when DB/schema requires it. */
export async function insertSavedScoreWithFallback(
  payload: Record<string, unknown>,
): Promise<{ id: string }> {
  let row: Record<string, unknown> = { ...payload };
  let strippedSnapshots = false;
  let clearedRoleBriefId = false;
  let lastError: unknown;

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await insertSavedScore(row);
    } catch (err) {
      lastError = err;
      const msg = errorMessage(err);

      if (
        !strippedSnapshots &&
        isMissingSnapshotColumnError(msg) &&
        (row.score_snapshot != null || row.role_brief_snapshot != null)
      ) {
        row = stripSnapshotColumns(row);
        strippedSnapshots = true;
        continue;
      }

      if (
        !clearedRoleBriefId &&
        isRoleBriefFkError(msg) &&
        row.role_brief_id != null
      ) {
        row = { ...row, role_brief_id: null };
        clearedRoleBriefId = true;
        continue;
      }

      throw err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to save score after retries");
}
