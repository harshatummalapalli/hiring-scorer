export function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

export function getSupabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

export function getSupabaseServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

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
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (isPlaceholder(url) || isPlaceholder(key)) {
    return "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see Supabase → Project Settings → API), then restart npm run dev.";
  }
  if (!url.startsWith("https://")) {
    return "NEXT_PUBLIC_SUPABASE_URL must start with https://";
  }
  return null;
}
