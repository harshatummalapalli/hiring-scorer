import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { getAuthenticatedUserId, AuthRequiredError } from "@/lib/supabase/created-by";

export class ForbiddenError extends Error {
  constructor(message = "Not authorized to access this resource.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Resource not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Defense-in-depth ownership check for a candidate record.
 *
 * RLS already scopes reads/writes to `created_by = auth.uid()` at the
 * database layer, so this should never actually deny a request that RLS
 * would have allowed. It exists so that:
 *  - a future RLS policy regression fails closed at the app layer too,
 *  - any code path that ends up using a service-role client is still safe,
 *  - we get a clear 403 instead of quietly leaking behavior through an
 *    empty-row 404 that could be timing/behavior-distinguishable.
 *
 * Returns the authenticated user id on success. Throws AuthRequiredError,
 * NotFoundError, or ForbiddenError otherwise.
 */
export async function assertCandidateAccess(candidateId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId(supabase);

  const { data, error } = await supabase
    .from("candidates")
    .select("id, created_by")
    .eq("id", candidateId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new NotFoundError("Candidate not found.");
  if (String(data.created_by) !== userId) {
    throw new ForbiddenError("Not authorized to access this candidate.");
  }
  return userId;
}

/**
 * Defense-in-depth ownership check for a role brief (job).
 * Same rationale as assertCandidateAccess above.
 */
export async function assertRoleBriefAccess(roleBriefId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId(supabase);

  const { data, error } = await supabase
    .from("role_briefs")
    .select("id, created_by")
    .eq("id", roleBriefId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new NotFoundError("Job not found.");
  if (String(data.created_by) !== userId) {
    throw new ForbiddenError("Not authorized to access this job.");
  }
  return userId;
}

export { AuthRequiredError };
