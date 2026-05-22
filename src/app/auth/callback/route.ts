import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { ensureWorkspaceSettingsForUser } from "@/lib/workspace/settings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/jobs";

  const host =
    request.headers.get("x-forwarded-host") ?? requestUrl.host;
  const protocol =
    request.headers.get("x-forwarded-proto") ??
    requestUrl.protocol.replace(":", "");
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? `${protocol}://${host}`;

  if (code) {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } =
        await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error(
          "[auth/callback] Exchange error:",
          error.message,
        );
        return NextResponse.redirect(
          `${baseUrl}/auth/signin?error=exchange_failed`,
        );
      }

      if (data.user) {
        try {
          await ensureWorkspaceSettingsForUser(supabase, data.user);
        } catch (e) {
          console.error(
            "[auth/callback] Workspace bootstrap error:",
            e,
          );
        }
        return NextResponse.redirect(`${baseUrl}${next}`);
      }
    } catch (e) {
      console.error("[auth/callback] Unexpected error:", e);
      return NextResponse.redirect(
        `${baseUrl}/auth/signin?error=unexpected`,
      );
    }
  }

  console.error("[auth/callback] No code in request");
  return NextResponse.redirect(`${baseUrl}/auth/signin?error=no_code`);
}
