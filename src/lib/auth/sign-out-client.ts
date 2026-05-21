import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/** Clears the browser session and lands on sign-in (no /api/* next param). */
export async function signOutAndRedirectToSignIn(): Promise<void> {
  try {
    await createSupabaseBrowserClient().auth.signOut({ scope: "global" });
  } catch {
    /* still navigate so the user is not stuck */
  }
  window.location.replace("/auth/signin?signed_out=1");
}
