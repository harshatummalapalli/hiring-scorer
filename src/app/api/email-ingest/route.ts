import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    deprecated: true,
    message:
      "Use /api/email-fetch to fetch emails and /api/email-process to process them.",
  });
}
