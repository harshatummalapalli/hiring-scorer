import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";

  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const redirectBase = isLocalEnv
    ? `${requestUrl.protocol}//${requestUrl.host}`
    : siteUrl
      ? siteUrl.replace(/\/$/, "")
      : forwardedHost
        ? `https://${forwardedHost}`
        : requestUrl.origin;

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      getSupabaseUrl(),
      getSupabaseAnonKey(),
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options),
              );
            } catch (e) {
              console.error("[auth/callback] Cookie set error:", e);
            }
          },
        },
      },
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("[auth/callback] Exchange error:", error.message);
      return NextResponse.redirect(
        `${redirectBase}/auth/signin?error=auth_callback_failed`,
      );
    }

    if (data.session) {
      console.log(
        "[auth/callback] Session created for:",
        data.user?.email,
      );
      return NextResponse.redirect(`${redirectBase}${next}`);
    }
  }

  console.error("[auth/callback] No code received");
  return NextResponse.redirect(
    `${redirectBase}/auth/signin?error=no_code`,
  );
}
