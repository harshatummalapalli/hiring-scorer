import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { SignInSessionBanner } from "@/components/auth/signin-session-banner";
import { SignInForm } from "@/components/auth/signin-form";
import { isSuperAdminUser } from "@/lib/auth/super-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";

export const dynamic = "force-dynamic";

type SignInPageProps = {
  searchParams: Promise<{
    signed_out?: string;
    choose_google?: string;
    error?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const justSignedOut = params.signed_out === "1";
  const chooseGoogle = params.choose_google === "1";
  const authError = params.error;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const showSessionBanner = Boolean(user && !justSignedOut);

  return (
    <AuthCard>
      {authError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Sign in failed. Please try again.
        </div>
      )}
      {showSessionBanner && user && (
        <SignInSessionBanner
          email={user.email}
          isSuperAdmin={await isSuperAdminUser(supabase, user)}
        />
      )}
      <Suspense fallback={null}>
        <SignInForm forceGoogleAccountPicker={chooseGoogle} />
      </Suspense>
    </AuthCard>
  );
}
