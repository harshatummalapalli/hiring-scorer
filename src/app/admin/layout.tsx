import Link from "next/link";
import { requireSuperAdmin } from "@/lib/admin/auth";
import { karta } from "@/lib/brand/karta";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdmin();

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
              Super Admin
            </p>
            <h1 className="text-lg font-semibold text-[#1E293B]">Karta Platform</h1>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              href="/admin"
              className="font-medium text-[#0D9488] hover:underline"
            >
              Overview
            </Link>
            <Link href="/jobs" className={`${karta.muted} hover:text-[#334155]`}>
              Back to app
            </Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
