import type { SupabaseClient } from "@supabase/supabase-js";

export class AuthRequiredError extends Error {
  constructor(message = "Sign in required.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export async function getAuthenticatedUserId(
  supabase: SupabaseClient,
): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.id) {
    throw new AuthRequiredError();
  }
  return user.id;
}

export function withCreatedBy<T extends Record<string, unknown>>(
  row: T,
  userId: string,
): T & { created_by: string } {
  return { ...row, created_by: userId };
}
