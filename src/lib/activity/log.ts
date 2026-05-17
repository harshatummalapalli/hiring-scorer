import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";

export type ActivityLogInput = {
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
};

export async function logWorkspaceActivity(
  userId: string,
  input: ActivityLogInput,
  supabase?: SupabaseClient,
): Promise<void> {
  try {
    const client = supabase ?? (await createSupabaseServerClient());
    await client.from("activity_log").insert({
      user_id: userId,
      action: input.action,
      resource_type: input.resourceType ?? null,
      resource_id: input.resourceId ?? null,
      metadata: input.metadata ?? {},
    });
  } catch {
    // Best-effort; do not fail the caller if logging is unavailable.
  }
}

export async function logWorkspaceActivityIfAuthed(
  input: ActivityLogInput,
  supabase?: SupabaseClient,
): Promise<void> {
  try {
    const client = supabase ?? (await createSupabaseServerClient());
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user?.id) return;
    await logWorkspaceActivity(user.id, input, client);
  } catch {
    // ignore
  }
}
