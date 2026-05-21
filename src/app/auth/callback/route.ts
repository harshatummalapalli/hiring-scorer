import { type NextRequest, NextResponse } from "next/server";
import { resolvePostLoginUrl } from "@/lib/auth/resolve-post-login-url";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler-client";
import { ensureWorkspaceSettingsForUser } from "@/lib/workspace/settings";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/jobs";

  if (code) {
    const probeResponse = new NextResponse();
    const supabase = createSupabaseRouteHandlerClient(request, probeResponse);
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      try {
        await ensureWorkspaceSettingsForUser(supabase, data.user);
      } catch {
        // Workspace bootstrap is best-effort
      }
      const landing = await resolvePostLoginUrl(supabase, data.user, next);
      const response = NextResponse.redirect(new URL(landing, request.url));
      const supabaseWithCookies = createSupabaseRouteHandlerClient(
        request,
        response,
      );
      await supabaseWithCookies.auth.getUser();
      return response;
    }
  }

  const signInUrl = new URL("/auth/signin", request.url);
  signInUrl.searchParams.set("error", "auth_callback");
  return NextResponse.redirect(signInUrl);
}
