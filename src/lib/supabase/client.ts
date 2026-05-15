import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function isPlaceholder(value: string): boolean {
  const v = value.toLowerCase();
  return (
    !value.trim() ||
    v.includes("your_") ||
    v.includes("_here") ||
    v === "undefined"
  );
}

export function getSupabaseConfigError(): string | null {
  if (isPlaceholder(supabaseUrl) || isPlaceholder(supabaseAnonKey)) {
    return "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see Supabase → Project Settings → API), then restart npm run dev.";
  }
  if (!supabaseUrl.startsWith("https://")) {
    return "NEXT_PUBLIC_SUPABASE_URL must start with https://";
  }
  return null;
}

let client: SupabaseClient | null = null;

export function createSupabaseClient(): SupabaseClient {
  const configError = getSupabaseConfigError();
  if (configError) {
    throw new Error(configError);
  }

  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey);
  }

  return client;
}
