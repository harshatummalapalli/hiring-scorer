import { NextResponse, type NextRequest } from "next/server";
import { extractCompanyDomain } from "@/lib/auth/email-domains";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { findExistingCompanyWorkspace } from "@/lib/workspace/existing-company-workspace";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get("domain")?.trim().toLowerCase();
  if (!domain) {
    return NextResponse.json({ exists: false });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const existing = await findExistingCompanyWorkspace(
      admin,
      domain,
      user.id,
    );
    if (!existing) {
      return NextResponse.json({ exists: false });
    }
    return NextResponse.json({
      exists: true,
      company_name: existing.company_name,
    });
  } catch (e) {
    console.error("[company-workspace]", e);
    return NextResponse.json(
      { error: "Lookup failed" },
      { status: 500 },
    );
  }
}
