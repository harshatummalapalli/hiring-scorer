"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { PageTransition } from "@/components/ui/page-transition";
import { isPublicPath } from "@/lib/auth/public-routes";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = isPublicPath(pathname) || pathname.startsWith("/admin");

  if (bare) {
    return <>{children}</>;
  }

  return (
    <>
      <AppHeader />
      <main className="flex-1">
        <PageTransition key={pathname}>{children}</PageTransition>
      </main>
    </>
  );
}
