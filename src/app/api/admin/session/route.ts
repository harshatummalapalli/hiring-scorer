import { NextResponse } from "next/server";
import { isSuperAdmin } from "@/lib/admin/auth";

/** Returns whether the signed-in user is a super admin (for demo view toggle). */
export async function GET() {
  try {
    const isAdmin = await isSuperAdmin();
    return NextResponse.json({ isSuperAdmin: isAdmin });
  } catch {
    return NextResponse.json({ isSuperAdmin: false });
  }
}
