import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { ensureWorkspaceSettingsForUser } from "@/lib/workspace/settings";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/jobs";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      try {
        await ensureWorkspaceSettingsForUser(supabase, data.user);
      } catch {
        // Workspace bootstrap is best-effort; user can set profile in Settings
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const signInUrl = new URL("/auth/signin", origin);
  signInUrl.searchParams.set("error", "auth_callback");
  return NextResponse.redirect(signInUrl.toString());
}
