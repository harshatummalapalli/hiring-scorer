import { NextResponse, type NextRequest } from "next/server";
import { extractCompanyDomain } from "@/lib/auth/email-domains";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { findExistingCompanyWorkspace } from "@/lib/workspace/existing-company-workspace";
import { applySignupCompanyMetadata } from "@/lib/workspace/signup-company";
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
          if (data.user.email) {
            await applySignupCompanyMetadata(
              supabase,
              data.user.id,
              data.user.email,
            );
          }
        } catch (e) {
          console.error(
            "[auth/callback] Workspace bootstrap error:",
            e,
          );
        }

        const redirectUrl = new URL(next, baseUrl);
        const email = data.user.email?.trim();
        const domain = email ? extractCompanyDomain(email) : null;
        if (domain) {
          try {
            const admin = createSupabaseAdminClient();
            const existing = await findExistingCompanyWorkspace(
              admin,
              domain,
              data.user.id,
            );
            if (existing) {
              redirectUrl.searchParams.set("workspace_hint", "existing");
              redirectUrl.searchParams.set(
                "company_name",
                existing.company_name,
              );
            }
          } catch (e) {
            console.error(
              "[auth/callback] Company workspace lookup error:",
              e,
            );
          }
        }

        return NextResponse.redirect(redirectUrl.toString());
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
