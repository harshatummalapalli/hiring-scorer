import { Suspense } from "react";
import { redirect } from "next/navigation";
import { isSuperAdminUser } from "@/lib/auth/super-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import {
  getWorkspaceProfileRow,
  needsOnboarding,
} from "@/lib/workspace/workspace-profiles";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  if (await isSuperAdminUser(supabase, user)) {
    redirect("/jobs");
  }

  let profile = null;
  try {
    profile = await getWorkspaceProfileRow(supabase, user.id);
  } catch {
    profile = null;
  }
  if (!needsOnboarding(profile)) {
    redirect("/jobs");
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-[#64748B]">
          Loading…
        </div>
      }
    >
      <OnboardingForm />
    </Suspense>
  );
}
