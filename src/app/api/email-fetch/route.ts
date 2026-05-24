import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function isCronAuthorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  try {
    if (!isCronAuthorised(request)) {
      try {
        await requireSuperAdmin();
      } catch {
        return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
      }
    }

    if (!process.env.GMAIL_INBOUND_USER || !process.env.GMAIL_INBOUND_APP_PASSWORD) {
      return NextResponse.json(
        { error: "Gmail inbound not configured" },
        { status: 503 },
      );
    }

    const adminSupabase = createSupabaseAdminClient();

  const { data: queued } = await adminSupabase
    .from("email_queue")
    .select("message_id")
    .gte(
      "created_at",
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    );

  const queuedIds = new Set((queued ?? []).map((r) => r.message_id));

  const { fetchUnprocessedEmails } =
    await import("@/lib/email/gmail-imap-client");
  const emails = await fetchUnprocessedEmails(queuedIds);

  if (emails.length === 0) {
    return NextResponse.json({ fetched: 0, queued: 0 });
  }

  const { extractJobSuffixFromEmail, resolveJobFromSuffix } =
    await import("@/lib/email/extract-job-from-email");

  let queuedCount = 0;
  let skippedNoSuffix = 0;
  let skippedUnknownJob = 0;
  let skippedUpload = 0;

  for (const email of emails) {
    const suffix = extractJobSuffixFromEmail(email.to, email.subject);
    if (!suffix) {
      skippedNoSuffix += email.attachments.length;
      continue;
    }

    const jobId = await resolveJobFromSuffix(suffix, adminSupabase);
    if (!jobId) {
      skippedUnknownJob += email.attachments.length;
      continue;
    }

    for (const attachment of email.attachments) {
      try {

        const storagePath = `email-queue/${email.messageId
          .replace(/[^a-z0-9]/gi, "-")
          .slice(0, 50)}-${attachment.filename}`;

        const { error: uploadError } = await adminSupabase.storage
          .from("resumes")
          .upload(storagePath, attachment.content, {
            contentType: attachment.contentType,
            upsert: true,
          });

        if (uploadError) {
          console.error(
            "[email-fetch] Storage upload failed:",
            uploadError.message,
          );
          skippedUpload += 1;
          continue;
        }

        const { error: insertError } = await adminSupabase
          .from("email_queue")
          .upsert(
            {
              message_id: email.messageId,
              job_id: jobId,
              sender_email: email.from,
              attachment_filename: attachment.filename,
              storage_path: storagePath,
              status: "pending",
            },
            {
              onConflict: "storage_path",
              ignoreDuplicates: true,
            },
          );

        if (!insertError) queuedCount++;
      } catch (err) {
        console.error(
          "[email-fetch] Error processing email:",
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  return NextResponse.json({
    fetched: emails.length,
    queued: queuedCount,
    skippedNoSuffix,
    skippedUnknownJob,
    skippedUpload,
  });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Email fetch failed";
    console.error("[email-fetch]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
