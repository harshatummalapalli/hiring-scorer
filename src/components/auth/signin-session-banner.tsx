"use client";

import Link from "next/link";
import { signOutAndRedirectToSignIn } from "@/lib/auth/sign-out-client";
import { karta } from "@/lib/brand/karta";

type SignInSessionBannerProps = {
  email: string | null | undefined;
  isSuperAdmin: boolean;
};

export function SignInSessionBanner({
  email,
  isSuperAdmin,
}: SignInSessionBannerProps) {
  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-950">
      <p className="font-medium">Active session in this browser</p>
      <p className="mt-1">
        Signed in as <span className="font-semibold">{email ?? "unknown"}</span>.
        {isSuperAdmin && (
          <span className="block mt-1 text-amber-800">
            This is the super admin account — onboarding is skipped and you go to
            Jobs.
          </span>
        )}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className={`${karta.btnSecondary} inline-block w-full px-4 py-2 text-center text-sm sm:w-auto`}
          onClick={() => void signOutAndRedirectToSignIn()}
        >
          Sign out completely
        </button>
        <Link
          href="/auth/signin?choose_google=1"
          className={`${karta.btnSecondary} inline-block px-4 py-2 text-center text-sm`}
        >
          Pick a different Google account
        </Link>
      </div>
    </div>
  );
}
