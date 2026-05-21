import { NextResponse } from "next/server";
import { resolvePostLoginUrl } from "@/lib/auth/resolve-post-login-url";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const intended = new URL(request.url).searchParams.get("intended");
  const url = await resolvePostLoginUrl(supabase, user, intended);

  return NextResponse.json({ url });
}
