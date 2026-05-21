/** Routes that do not require an authenticated Supabase session. */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/auth/signin" || pathname === "/auth/signup") return true;
  if (pathname === "/auth/callback") return true;
  if (pathname === "/auth/signout") return true;
  if (/^\/apply\/[^/]+$/.test(pathname)) return true;
  if (/^\/apply\/[^/]+\/success$/.test(pathname)) return true;
  if (pathname.startsWith("/api/apply/")) return true;
  return false;
}

export function isAuthEntryPath(pathname: string): boolean {
  return (
    pathname === "/auth/signin" ||
    pathname === "/auth/signup" ||
    pathname === "/login"
  );
}
