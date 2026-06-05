import { NextResponse } from "next/server";
import { triggerParsing } from "@/lib/ingestion/trigger-parsing";
import { getCandidateById, updateCandidate } from "@/lib/supabase/candidates";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const { data: owned } = await supabase
      .from("candidates")
      .select("id")
      .eq("id", id)
      .eq("created_by", user.id)
      .maybeSingle();

    if (!owned) {
      return NextResponse.json(
        { error: "Candidate not found." },
        { status: 404 },
      );
    }

    const candidate = await getCandidateById(id);
    if (!candidate) {
      return NextResponse.json(
        { error: "Candidate not found." },
        { status: 404 },
      );
    }

    const canRetry =
      candidate.parsing_status === "failed" ||
      candidate.parsing_status === "pending" ||
      (candidate.parsing_status === "complete" &&
        (candidate.scoring_status === "unscored" ||
          candidate.scoring_status === "needs_scoring"));

    if (!canRetry) {
      return NextResponse.json(
        { error: "Candidate is not eligible for retry." },
        { status: 400 },
      );
    }

    if (!candidate.resume_text?.trim()) {
      return NextResponse.json(
        { error: "Resume text is missing — re-upload the resume." },
        { status: 400 },
      );
    }

    await updateCandidate(id, {
      parsing_status: "pending",
      scoring_status: "unscored",
    });

    void triggerParsing(
      id,
      candidate.resume_text,
      candidate.resume_filename ?? "candidate-resume.pdf",
      candidate.job_id ?? null,
      request,
    ).catch(console.warn);

    return NextResponse.json({ status: "retrying" });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to retry parsing";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
