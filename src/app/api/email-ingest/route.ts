import { NextResponse } from "next/server";
import { createActivity } from "@/lib/candidates/activity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  extractJobSuffixFromEmail,
  resolveJobFromSuffix,
} from "@/lib/email/extract-job-from-email";

export const maxDuration = 60;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET ?? "";
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  if (!process.env.GMAIL_INBOUND_USER || !process.env.GMAIL_INBOUND_APP_PASSWORD) {
    return NextResponse.json(
      { error: "Gmail inbound not configured" },
      { status: 503 },
    );
  }

  const parserBase = process.env.RESUME_PARSER_URL ?? "";
  if (!parserBase) {
    return NextResponse.json({
      processed: 0,
      successful: 0,
      results: [],
      note: "Parser URL not configured",
    });
  }

  try {
    const health = await fetch(`${parserBase}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!health.ok) throw new Error("Not healthy");
  } catch {
    return NextResponse.json({
      processed: 0,
      successful: 0,
      results: [],
      note: "Parser not ready — will retry next run",
    });
  }

  const adminSupabase = createSupabaseAdminClient();

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: processed } = await adminSupabase
    .from("email_ingestion_log")
    .select("message_id")
    .gte("processed_at", since);

  const processedIds = new Set(
    (processed ?? []).map((r) => String(r.message_id)),
  );

  const { fetchUnprocessedEmails } = await import("@/lib/email/gmail-imap-client");
  const emails = await fetchUnprocessedEmails(processedIds);

  const results: {
    messageId: string;
    jobId: string | null;
    candidateId: string | null;
    success: boolean;
    error: string | null;
  }[] = [];

  for (const email of emails) {
    for (const attachment of email.attachments) {
      let jobId: string | null = null;
      let candidateId: string | null = null;
      let success = false;
      let errorMessage: string | null = null;

      try {
        const suffix = extractJobSuffixFromEmail(email.to);
        if (!suffix) {
          throw new Error("No job suffix in recipient address");
        }

        jobId = await resolveJobFromSuffix(suffix, adminSupabase);
        if (!jobId) {
          throw new Error(`No active job found for suffix: ${suffix}`);
        }

        const { data: brief } = await adminSupabase
          .from("role_briefs")
          .select("created_by")
          .eq("id", jobId)
          .single();

        const arrayBuffer = attachment.content.buffer.slice(
          attachment.content.byteOffset,
          attachment.content.byteOffset + attachment.content.byteLength,
        ) as ArrayBuffer;

        const { ingestResumeFromBytes } = await import(
          "@/lib/ingestion/ingest-resume"
        );
        const ingested = await ingestResumeFromBytes(
          arrayBuffer,
          attachment.filename,
          attachment.contentType,
        );

        const { data: inserted, error: insertError } = await adminSupabase
          .from("candidates")
          .insert({
            display_name: ingested.signalProfile.display_name,
            resume_text: ingested.resumeText,
            resume_filename: attachment.filename,
            signal_profile: ingested.signalProfile,
            source: "email_inbound",
            job_id: jobId,
            created_by: brief?.created_by ?? null,
            application_email: email.from,
            scoring_status: "unscored",
            activity: [
              createActivity("added", "Added via inbound email"),
            ],
          })
          .select("id")
          .single();

        if (insertError) throw new Error(insertError.message);
        candidateId = inserted?.id != null ? String(inserted.id) : null;
        success = true;
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error("[email-ingest] Failed:", errorMessage);
      }

      if (success) {
        await adminSupabase.from("email_ingestion_log").upsert(
          {
            message_id: email.messageId,
            job_id: jobId,
            candidate_id: candidateId,
            success: true,
            sender_email: email.from,
            attachment_name: attachment.filename,
          },
          { onConflict: "message_id", ignoreDuplicates: true },
        );
      }

      results.push({
        messageId: email.messageId,
        jobId,
        candidateId,
        success,
        error: errorMessage,
      });
    }
  }

  return NextResponse.json({
    processed: results.length,
    successful: results.filter((r) => r.success).length,
    results,
  });
}
