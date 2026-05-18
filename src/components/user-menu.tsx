"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  displayNameFromProfile,
  getWorkspaceProfile,
  initialFromProfile,
  type WorkspaceProfile,
} from "@/lib/workspace/settings";

export function UserMenu() {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<WorkspaceProfile | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setEmail(user.email ?? null);
      try {
        const ws = await getWorkspaceProfile(supabase, user.id);
        setProfile(ws);
      } catch {
        setProfile({ first_name: "", company_name: "" });
      }
    })();
  }, []);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const displayName = profile
    ? displayNameFromProfile(profile, email)
    : email?.split("@")[0] ?? "User";
  const initial = profile
    ? initialFromProfile(profile, email)
    : (displayName.charAt(0) || "U").toUpperCase();

  const signOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/auth/signin");
    router.refresh();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-1 py-1 text-white/90 hover:bg-white/10"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0D9488] text-sm font-semibold text-white transition-shadow duration-150 hover:ring-2 hover:ring-teal-400"
          aria-hidden
        >
          {initial}
        </span>
        <ChevronDown className="h-4 w-4 opacity-80" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-[#1E293B]">{displayName}</p>
            {profile?.company_name && (
              <p className="mt-0.5 text-xs text-[#64748B]">
                {profile.company_name}
              </p>
            )}
            {email && (
              <p className="mt-1 truncate text-xs text-[#94A3B8]">{email}</p>
            )}
          </div>
          <Link
            href="/settings"
            role="menuitem"
            className="flex items-center gap-2 px-4 py-2 text-sm text-[#334155] hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            <Settings className="h-4 w-4 text-[#64748B]" />
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#334155] hover:bg-slate-50"
            onClick={() => void signOut()}
          >
            <LogOut className="h-4 w-4 text-[#64748B]" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
