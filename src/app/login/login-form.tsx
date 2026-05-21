"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { karta } from "@/lib/brand/karta";
import {
  authFinishUrl,
  navigateAfterAuth,
} from "@/lib/auth/post-login-redirect";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/jobs";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      if (mode === "sign_up") {
        const { error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpError) throw signUpError;
        setError(
          "Check your email to confirm your account, then sign in.",
        );
        setMode("sign_in");
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      navigateAfterAuth(authFinishUrl(next));
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <h1 className={karta.pageTitle}>Sign in to Karta</h1>
      <p className="mt-2 text-sm text-[#64748B]">
        Your recruiting data is private to your account.
      </p>
      <form onSubmit={(e) => void handleSubmit(e)} className={`mt-8 ${karta.card} p-6`}>
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
        <label className="mt-4 block text-sm font-medium text-[#334155]">
          Password
          <input
            type="password"
            required
            minLength={8}
            autoComplete={
              mode === "sign_up" ? "new-password" : "current-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`mt-1 w-full ${karta.input}`}
          />
        </label>
        {error && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className={`mt-6 w-full ${karta.btnPrimary}`}
        >
          {loading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          ) : mode === "sign_up" ? (
            "Create account"
          ) : (
            "Sign in"
          )}
        </button>
        <button
          type="button"
          className="mt-4 w-full text-center text-sm font-medium text-[#0D9488] hover:underline"
          onClick={() =>
            setMode((m) => (m === "sign_in" ? "sign_up" : "sign_in"))
          }
        >
          {mode === "sign_in"
            ? "Need an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
