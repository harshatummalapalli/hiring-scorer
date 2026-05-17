"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { isPublicPath } from "@/lib/auth/public-routes";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = isPublicPath(pathname);

  if (bare) {
    return <>{children}</>;
  }

  return (
    <>
      <AppHeader />
      <main className="flex-1">{children}</main>
    </>
  );
}
