"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthDivider } from "@/components/auth/auth-divider";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { karta } from "@/lib/brand/karta";
import {
  authFinishUrl,
  navigateAfterAuth,
  safeIntendedPath,
} from "@/lib/auth/post-login-redirect";
import { signOutAndRedirectToSignIn } from "@/lib/auth/sign-out-client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type SignInFormProps = {
  forceGoogleAccountPicker?: boolean;
};

export function SignInForm({
  forceGoogleAccountPicker = false,
}: SignInFormProps) {
  const searchParams = useSearchParams();
  const signedOut = searchParams.get("signed_out") === "1";
  const next =
    signedOut
      ? "/jobs"
      : safeIntendedPath(searchParams.get("next")) ?? "/jobs";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("signed_out") === "1") {
      setError(null);
      setInfo("Signed out. Sign in with the account you want to use.");
      void createSupabaseBrowserClient().auth.signOut({ scope: "global" });
    }
    if (searchParams.get("choose_google") === "1") {
      setInfo(
        "Use “Choose Google account” below, or sign in with email + password to test onboarding.",
      );
    }
    if (searchParams.get("error") === "session_missing") {
      setError(
        "Session did not persist. Sign out, then try email + password sign-in.",
      );
    }
    if (searchParams.get("error") === "no_code") {
      setError(
        "Google sign-in did not return a verification code. Please try again.",
      );
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut({ scope: "global" });
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      navigateAfterAuth(authFinishUrl(next));
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6 rounded-lg border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-800">
        <p className="font-medium">Welcome to Kharta</p>
        <p className="mt-0.5 text-teal-700">
          Sign in to access your recruiting workspace.
        </p>
      </div>

      {info && (
        <p className="text-sm text-[#0D9488]" role="status">
          {info}
        </p>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <p className="text-sm font-semibold text-[#1E293B]">Sign in with email</p>
        <label className="block text-sm font-medium text-[#334155]">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`mt-1 w-full ${karta.input}`}
          />
        </label>
        <label className="block text-sm font-medium text-[#334155]">
          Password
          <input
            type="password"
            required
            minLength={8}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`mt-1 w-full ${karta.input}`}
          />
        </label>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className={`w-full ${karta.btnPrimary}`}
        >
          {loading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          ) : (
            "Sign in with email"
          )}
        </button>
      </form>

      <AuthDivider />

      <div>
        <p className="mb-3 text-sm font-semibold text-[#1E293B]">Or use Google</p>
        <GoogleAuthButton
          next={next}
          forceAccountPicker={forceGoogleAccountPicker}
        />
      </div>

      <p className="text-center text-sm text-[#64748B]">
        New to Kharta?{" "}
        <Link
          href="/auth/signup"
          className="font-medium text-[#0D9488] hover:underline"
        >
          Create your account
        </Link>
      </p>
      <p className="text-center text-sm text-[#94A3B8]">
        <button
          type="button"
          className="font-medium text-[#0D9488] hover:underline"
          onClick={() => void signOutAndRedirectToSignIn()}
        >
          Sign out of Kharta completely
        </button>
      </p>
    </div>
  );
}
