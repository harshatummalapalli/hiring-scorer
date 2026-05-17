"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseConfigError, getSupabaseUrl } from "@/lib/supabase/env";

let client: SupabaseClient | null = null;

export function createSupabaseBrowserClient(): SupabaseClient {
  const configError = getSupabaseConfigError();
  if (configError) {
    throw new Error(configError);
  }

  if (!client) {
    client = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
  }

  return client;
}

/** @deprecated Use createSupabaseBrowserClient — kept for existing imports. */
export function createSupabaseClient(): SupabaseClient {
  return createSupabaseBrowserClient();
}
