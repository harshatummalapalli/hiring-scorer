export function buildFullApplyUrl(applyLink: string | null, token: string | null): string {
  const path =
    applyLink?.trim() ||
    (token?.trim() ? `/apply/${token.trim()}` : "");
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  return base ? `${base}${path.startsWith("/") ? path : `/${path}`}` : path;
}
