"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, Info, Loader2 } from "lucide-react";
import { AuthDivider } from "@/components/auth/auth-divider";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { karta } from "@/lib/brand/karta";
import {
  extractCompanyDomain,
  extractCompanyName,
  isPersonalEmail,
} from "@/lib/auth/email-domains";
import {
  authFinishUrl,
  navigateAfterAuth,
} from "@/lib/auth/post-login-redirect";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { applySignupCompanyMetadata } from "@/lib/workspace/signup-company";
import { upsertWorkspaceSettings } from "@/lib/workspace/settings";

export function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isPersonal, setIsPersonal] = useState(false);
  const [continueWithPersonal, setContinueWithPersonal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const trimmedEmail = email.trim();
  const detectedCompany = extractCompanyName(trimmedEmail);
  const showPersonalWarning = isPersonal && !continueWithPersonal;
  const usePersonalSubmitStyle = isPersonal && !continueWithPersonal;

  const handleEmailChange = (value: string) => {
    setEmail(value);
    const personal = isPersonalEmail(value);
    setIsPersonal(personal);
    if (!personal) {
      setContinueWithPersonal(false);
      const inferred = extractCompanyName(value.trim());
      if (inferred) setCompanyName(inferred);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const origin = window.location.origin;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            company_name: companyName.trim() || detectedCompany || "",
          },
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });
      if (signUpError) throw signUpError;

      if (data.session?.user) {
        const userId = data.session.user.id;
        await upsertWorkspaceSettings(supabase, userId, {
          first_name: firstName.trim(),
          company_name:
            companyName.trim() || detectedCompany || "",
        });
        await applySignupCompanyMetadata(supabase, userId, trimmedEmail);

        const domain = extractCompanyDomain(trimmedEmail);
        let destination = "/jobs";
        if (domain) {
          const res = await fetch(
            `/api/auth/company-workspace?domain=${encodeURIComponent(domain)}`,
          );
          if (res.ok) {
            const body = (await res.json()) as {
              exists?: boolean;
              company_name?: string;
            };
            if (body.exists && body.company_name) {
              const params = new URLSearchParams({
                workspace_hint: "existing",
                company_name: body.company_name,
              });
              destination = `/jobs?${params.toString()}`;
            }
          }
        }

        navigateAfterAuth(authFinishUrl(destination));
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
          Work email
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            className={`mt-1 w-full ${karta.input}`}
          />
        </label>
        {showPersonalWarning && (
          <div className="mt-2 flex items-start gap-2 text-sm text-amber-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              Personal email detected. We recommend your work email for team
              features and company-level analytics.{" "}
              <button
                type="button"
                className="text-[#0D9488] underline"
                onClick={() => setContinueWithPersonal(true)}
              >
                Continue anyway
              </button>
            </span>
          </div>
        )}
        {trimmedEmail && !isPersonal && detectedCompany && (
          <div className="mt-2 flex items-center gap-2 text-sm text-[#0D9488]">
            <Building2 className="h-4 w-4 shrink-0" aria-hidden />
            <span>{detectedCompany} workspace</span>
          </div>
        )}
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
          className={`w-full ${
            usePersonalSubmitStyle ? karta.btnSecondary : karta.btnPrimary
          }`}
        >
          {loading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          ) : usePersonalSubmitStyle ? (
            "Continue with personal email"
          ) : (
            "Sign up"
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
