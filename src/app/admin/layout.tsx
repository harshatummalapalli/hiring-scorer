import { requireSuperAdmin } from "@/lib/admin/auth";
import { AdminShellHeader } from "@/components/admin/admin-shell-header";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdmin();

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <AdminShellHeader />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
