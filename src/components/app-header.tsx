"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KARTA } from "@/lib/brand/karta";
import { SuperAdminViewToggle } from "@/components/admin/super-admin-view-toggle";
import { UserMenu } from "@/components/user-menu";

const NAV = [
  { href: "/jobs", label: "Jobs" },
  { href: "/talent-pool", label: "Talent Pool" },
] as const;

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white">
      <div className="mx-auto flex h-auto min-h-14 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/jobs" className="flex min-w-0 flex-col gap-0.5">
          <span className="bg-gradient-to-r from-white via-teal-200 to-white bg-clip-text text-lg font-semibold tracking-tight text-transparent">
            {KARTA.name}
          </span>
          <span className="hidden text-xs font-light text-white/60 sm:inline">
            {KARTA.tagline}
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <nav className="flex shrink-0 items-center gap-1 text-sm">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative rounded-md px-3 py-1.5 transition-colors ${
                    active
                      ? "font-semibold text-white"
                      : "font-normal text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                  {active && (
                    <span
                      className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-teal-400"
                      aria-hidden
                    />
                  )}
                </Link>
              );
            })}
          </nav>
          <SuperAdminViewToggle variant="dark" />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
