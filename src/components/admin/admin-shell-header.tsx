"use client";

import Link from "next/link";
import { SuperAdminViewToggle } from "@/components/admin/super-admin-view-toggle";
import { karta } from "@/lib/brand/karta";

export function AdminShellHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
            Super Admin
          </p>
          <h1 className="text-lg font-semibold text-[#1E293B]">Kharta Platform</h1>
        </div>
        <nav className="flex flex-wrap items-center gap-3 text-sm">
          <SuperAdminViewToggle variant="light" />
          <Link
            href="/admin"
            className="font-medium text-[#0D9488] hover:underline"
          >
            Overview
          </Link>
          <Link href="/jobs" className={`${karta.muted} hover:text-[#334155]`}>
            Jobs
          </Link>
        </nav>
      </div>
    </header>
  );
}
