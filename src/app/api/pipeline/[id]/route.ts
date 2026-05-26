import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { updatePipelineCandidate } from "@/lib/supabase/pipeline";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 },
      );
    }

    const { id } = await params;
    const body = (await request.json()) as {
      relocation?: string;
      present_salary?: string;
      expected_salary?: string;
      recruiter_notes?: string;
    };

    const row = await updatePipelineCandidate(id, {
      relocation: body.relocation,
      present_salary: body.present_salary,
      expected_salary: body.expected_salary,
      recruiter_notes: body.recruiter_notes,
    });

    return NextResponse.json({ row });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update pipeline row";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
