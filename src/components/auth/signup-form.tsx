"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AuthDivider } from "@/components/auth/auth-divider";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { karta } from "@/lib/brand/karta";
import {
  authFinishUrl,
  navigateAfterAuth,
} from "@/lib/auth/post-login-redirect";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { upsertWorkspaceSettings } from "@/lib/workspace/settings";

export function SignUpForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            company_name: companyName.trim(),
          },
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });
      if (signUpError) throw signUpError;

      if (data.session?.user) {
        await upsertWorkspaceSettings(supabase, data.session.user.id, {
          first_name: firstName.trim(),
          company_name: companyName.trim(),
        });
        navigateAfterAuth(authFinishUrl("/jobs"));
        return;
      }

      setMessage(
        "Check your email to confirm your account, then sign in.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <GoogleAuthButton />
      <AuthDivider />
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`mt-1 w-full ${karta.input}`}
          />
        </label>
        <label className="block text-sm font-medium text-[#334155]">
          First name
          <input
            type="text"
            required
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={`mt-1 w-full ${karta.input}`}
          />
        </label>
        <label className="block text-sm font-medium text-[#334155]">
          Company name
          <input
            type="text"
            autoComplete="organization"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className={`mt-1 w-full ${karta.input}`}
          />
        </label>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="text-sm text-[#0D9488]" role="status">
            {message}
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
            "Create account"
          )}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-[#64748B]">
        Already have an account?{" "}
        <Link
          href="/auth/signin"
          className="font-medium text-[#0D9488] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
