import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSuperAdminUser } from "@/lib/auth/super-admin";
import { isAuthEntryPath, isPublicPath } from "@/lib/auth/public-routes";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import {
  getWorkspaceProfileRow,
  needsOnboarding,
} from "@/lib/workspace/workspace-profiles";

function isApiRoute(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function isPostLoginHandoff(pathname: string): boolean {
  return pathname === "/auth/finish";
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (pathname === "/login") {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/auth/signin";
    signInUrl.search = request.nextUrl.search;
    return NextResponse.redirect(signInUrl);
  }

  if (!user && !isPublicPath(pathname)) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/auth/signin";
    signInUrl.search = "";
    if (!isApiRoute(pathname)) {
      signInUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(signInUrl);
  }

  if (user && isAuthEntryPath(pathname)) {
    // Let /auth/signin show "already signed in" + sign-out (switch accounts).
    if (pathname === "/auth/signin") {
      return supabaseResponse;
    }
    const redirectUrl = request.nextUrl.clone();
    const superAdmin = await isSuperAdminUser(supabase, user);
    redirectUrl.pathname = superAdmin ? "/jobs" : "/onboarding";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (
    user &&
    !isPublicPath(pathname) &&
    !isApiRoute(pathname) &&
    !isPostLoginHandoff(pathname) &&
    pathname !== "/onboarding" &&
    !(await isSuperAdminUser(supabase, user))
  ) {
    let workspaceProfile = null;
    try {
      workspaceProfile = await getWorkspaceProfileRow(supabase, user.id);
    } catch {
      /* Table missing or transient DB error — require onboarding */
      workspaceProfile = null;
    }
    if (needsOnboarding(workspaceProfile)) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = "/onboarding";
      onboardingUrl.search = "";
      return NextResponse.redirect(onboardingUrl);
    }
  }

  return supabaseResponse;
}
