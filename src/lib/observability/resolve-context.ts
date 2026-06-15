import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type ObservabilityIds = {
  recruiterId?: string;
  workspaceId?: string;
};

/** Resolve workspace_profiles.id for a recruiter user id (fire-and-forget safe). */
export async function resolveWorkspaceIdForRecruiter(
  recruiterId: string,
): Promise<string | undefined> {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("workspace_profiles")
      .select("id")
      .eq("user_id", recruiterId)
      .maybeSingle();

    if (error || !data?.id) return undefined;
    return String(data.id);
  } catch {
    return undefined;
  }
}

export async function resolveObservabilityIds(
  recruiterId: string,
): Promise<ObservabilityIds> {
  const workspaceId = await resolveWorkspaceIdForRecruiter(recruiterId);
  return { recruiterId, workspaceId };
}
