import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/route-handler-client";

export const dynamic = "force-dynamic";

async function signOutAndRedirect(request: NextRequest) {
  const signIn = request.nextUrl.clone();
  signIn.pathname = "/auth/signin";
  signIn.search = "";
  signIn.searchParams.set("signed_out", "1");

  const response = NextResponse.redirect(signIn);
  const supabase = createSupabaseRouteHandlerClient(request, response);
  await supabase.auth.signOut({ scope: "global" });
  return response;
}

/** Clears the Supabase session cookies and sends the browser to sign-in. */
export async function GET(request: NextRequest) {
  return signOutAndRedirect(request);
}

export async function POST(request: NextRequest) {
  return signOutAndRedirect(request);
}
