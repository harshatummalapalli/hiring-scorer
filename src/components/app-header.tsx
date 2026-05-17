"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KARTA, karta } from "@/lib/brand/karta";
import { UserMenu } from "@/components/user-menu";

const NAV = [
  { href: "/jobs", label: "Jobs" },
  { href: "/talent-pool", label: "Talent Pool" },
] as const;

function navLinkClass(active: boolean): string {
  return active
    ? "rounded-md bg-[#0D9488] px-3 py-1.5 font-medium text-white"
    : "rounded-md px-3 py-1.5 font-medium text-white/90 hover:bg-white/10 hover:text-white";
}

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className={`sticky top-0 z-50 border-b border-slate-700/50 ${karta.nav}`}>
      <div className="mx-auto flex h-auto min-h-14 max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/jobs" className="flex min-w-0 flex-col gap-0.5">
          <span className="text-lg font-semibold tracking-tight text-white">
            {KARTA.name}
          </span>
          <span className="hidden text-xs font-light text-white/60 sm:inline">
            {KARTA.tagline}
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <nav className="flex shrink-0 items-center gap-1 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={navLinkClass(pathname.startsWith(item.href))}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
