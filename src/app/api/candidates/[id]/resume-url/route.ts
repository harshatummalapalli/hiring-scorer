import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/created-by";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { createSignedResumeUrl } from "@/lib/storage/resumes";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const userId = await getAuthenticatedUserId(supabase);

    const { data, error } = await supabase
      .from("candidates")
      .select("id, created_by, resume_file_path")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      if (error.message?.toLowerCase().includes("resume_file_path")) {
        return NextResponse.json(
          { error: "Resume storage is not configured yet." },
          { status: 503 },
        );
      }
      throw new Error(error.message);
    }

    if (!data) {
      return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
    }

    if (String(data.created_by) !== userId) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }

    const path = data.resume_file_path != null ? String(data.resume_file_path) : "";
    if (!path) {
      return NextResponse.json(
        { error: "No stored resume for this candidate." },
        { status: 404 },
      );
    }

    const url = await createSignedResumeUrl(path, 60);
    return NextResponse.json({ url });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create download URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
