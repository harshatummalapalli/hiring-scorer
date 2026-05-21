import { type NextRequest, NextResponse } from "next/server";
import { resolvePostLoginUrl } from "@/lib/auth/resolve-post-login-url";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler-client";

/**
 * Server redirect after client sign-in so the session cookie is on the request
 * before we decide between /jobs and /onboarding.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const intended = searchParams.get("intended");

  const probeResponse = new NextResponse();
  const supabase = createSupabaseRouteHandlerClient(request, probeResponse);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let target: URL;
  if (!user) {
    target = new URL("/auth/signin", request.url);
    target.searchParams.set("error", "session_missing");
    if (intended) target.searchParams.set("next", intended);
  } else {
    const landing = await resolvePostLoginUrl(supabase, user, intended);
    target = new URL(landing, request.url);
  }

  const response = NextResponse.redirect(target);
  const supabaseWithCookies = createSupabaseRouteHandlerClient(
    request,
    response,
  );
  await supabaseWithCookies.auth.getUser();

  return response;
}
