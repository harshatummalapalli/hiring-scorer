import { redirect } from "next/navigation";
import { resolvePostLoginUrl } from "@/lib/auth/resolve-post-login-url";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";

export default async function Home() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  const landing = await resolvePostLoginUrl(supabase, user, "/jobs");
  redirect(landing);
}
