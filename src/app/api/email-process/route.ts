import { after } from "next/server";
import { NextResponse } from "next/server";
import { createActivity } from "@/lib/candidates/activity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { insertApplicationCandidate } from "@/lib/supabase/candidates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function requireCronSecret(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(request: Request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const adminSupabase = createSupabaseAdminClient();

  const { data: item, error } = await adminSupabase
    .from("email_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { processed: 0, error: error.message },
      { status: 500 },
    );
  }

  if (!item) {
    return NextResponse.json({
      processed: 0,
      message: "No pending emails in queue",
    });
  }

  await adminSupabase
    .from("email_queue")
    .update({ status: "processing" })
    .eq("id", item.id);

  try {
    const { data: fileData, error: downloadError } = await adminSupabase.storage
      .from("resumes")
      .download(item.storage_path);

    if (downloadError || !fileData) {
      throw new Error(
        `Storage download failed: ${downloadError?.message ?? "no file"}`,
      );
    }

    const arrayBuffer = await fileData.arrayBuffer();

    const { data: brief } = await adminSupabase
      .from("role_briefs")
      .select("created_by")
      .eq("id", item.job_id)
      .single();

    const ownerUserId =
      brief?.created_by != null ? String(brief.created_by) : null;
    if (!ownerUserId) {
      throw new Error("Job has no owner (created_by)");
    }

    const { ingestResumeFromBytes } =
      await import("@/lib/ingestion/ingest-resume");
    const ingested = await ingestResumeFromBytes(
      arrayBuffer,
      item.attachment_filename,
    );

    const candidate = await insertApplicationCandidate(
      {
        display_name: ingested.signalProfile.display_name,
        resume_text: ingested.strippedResumeText,
        resume_filename: item.attachment_filename,
        signal_profile: ingested.signalProfile,
        source: "email_inbound",
        job_id: item.job_id,
        application_email: ingested.signalProfile.extracted_email,
        application_phone: ingested.signalProfile.extracted_phone,
        scoring_status: "unscored",
        activity: [
          createActivity("added", "Added via inbound email"),
        ],
      },
      ownerUserId,
    );

    if (ingested.structuredResume) {
      const { persistResumeIntelligence } =
        await import("@/lib/ingestion/persist-intelligence");
      await persistResumeIntelligence({
        candidateId: candidate.id,
        structuredResume: ingested.structuredResume,
        parseResult: ingested.parseResult,
      });
    }

    await adminSupabase
      .from("email_queue")
      .update({
        status: "done",
        processed_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    await adminSupabase.storage.from("resumes").remove([item.storage_path]);

    await adminSupabase.from("email_ingestion_log").upsert(
      {
        message_id: item.message_id,
        job_id: item.job_id,
        candidate_id: candidate.id,
        success: true,
        sender_email: item.sender_email,
        attachment_name: item.attachment_filename,
      },
      { onConflict: "message_id", ignoreDuplicates: true },
    );

    const candidateId = candidate.id;
    const jobId = item.job_id;
    after(async () => {
      try {
        const { runCronAutoEvaluation } =
          await import("@/lib/scoring/run-cron-auto-evaluation");
        await runCronAutoEvaluation(
          adminSupabase,
          candidateId,
          jobId,
          ownerUserId,
        );
      } catch (err) {
        console.error("[email-process] Auto-evaluation failed:", err);
      }
    });

    return NextResponse.json({
      processed: 1,
      candidateId: candidate.id,
      candidateName: ingested.signalProfile.display_name,
      jobId: item.job_id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    await adminSupabase
      .from("email_queue")
      .update({
        status: "failed",
        error_message: message,
      })
      .eq("id", item.id);

    return NextResponse.json({
      processed: 0,
      error: message,
    });
  }
}

export async function GET(request: Request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const adminSupabase = createSupabaseAdminClient();

  const { data } = await adminSupabase
    .from("email_queue")
    .update({ status: "pending", error_message: null })
    .eq("status", "failed")
    .select("id");

  return NextResponse.json({
    reset: data?.length ?? 0,
  });
}
