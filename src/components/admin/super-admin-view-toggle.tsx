"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type ViewMode = "recruiter" | "platform";
type Variant = "dark" | "light";

const VIEW_COOKIE = "karta_super_admin_view";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

function setViewCookie(mode: ViewMode) {
  document.cookie = `${VIEW_COOKIE}=${mode};path=/;max-age=${COOKIE_MAX_AGE};SameSite=Lax`;
}

function modeFromPath(pathname: string): ViewMode {
  return pathname.startsWith("/admin") ? "platform" : "recruiter";
}

export function SuperAdminViewToggle({ variant = "light" }: { variant?: Variant }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [ready, setReady] = useState(false);
  const mode = modeFromPath(pathname);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/session", { cache: "no-store" });
        const json = (await res.json()) as { isSuperAdmin?: boolean };
        if (!cancelled) setIsSuperAdmin(Boolean(json.isSuperAdmin));
      } catch {
        if (!cancelled) setIsSuperAdmin(false);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready || !isSuperAdmin) return null;

  const shell =
    variant === "dark"
      ? "rounded-lg border border-white/20 bg-white/10 p-0.5"
      : "rounded-lg border border-slate-200 bg-slate-100 p-0.5";

  const active =
    variant === "dark"
      ? "bg-white text-[#0D9488] shadow-sm"
      : "bg-white text-[#0D9488] shadow-sm";

  const inactive =
    variant === "dark"
      ? "text-white/85 hover:bg-white/10 hover:text-white"
      : "text-[#64748B] hover:text-[#334155]";

  const switchTo = (next: ViewMode) => {
    if (next === mode) return;
    setViewCookie(next);
    router.push(next === "platform" ? "/admin" : "/jobs");
  };

  return (
    <div className={shell} role="group" aria-label="Demo view">
      <button
        type="button"
        onClick={() => switchTo("recruiter")}
        className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors sm:px-3 sm:text-sm ${
          mode === "recruiter" ? active : inactive
        }`}
        aria-pressed={mode === "recruiter"}
      >
        Recruiter
      </button>
      <button
        type="button"
        onClick={() => switchTo("platform")}
        className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors sm:px-3 sm:text-sm ${
          mode === "platform" ? active : inactive
        }`}
        aria-pressed={mode === "platform"}
      >
        Super Admin
      </button>
    </div>
  );
}
