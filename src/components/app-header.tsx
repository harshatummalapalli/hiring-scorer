"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { KARTA, karta } from "@/lib/brand/karta";

const NAV = [
  { href: "/role-briefs", label: "Job Roles" },
  { href: "/candidates", label: "Candidates" },
  { href: "/pipeline", label: "Pipeline" },
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
        <Link href="/role-briefs" className="flex min-w-0 flex-col gap-0.5">
          <span className="text-lg font-semibold tracking-tight text-white">
            {KARTA.name}
          </span>
          <span className="text-xs font-light text-white/60">{KARTA.tagline}</span>
        </Link>
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
      </div>
    </header>
  );
}
