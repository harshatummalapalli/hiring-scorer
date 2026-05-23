import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/admin/auth";
import { resetAllWorkspaceData } from "@/lib/admin/reset-workspace-data";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireSuperAdmin();

    const body = (await request.json()) as { confirm?: string };
    if (body.confirm !== "RESET_ALL_WORKSPACE_DATA") {
      return NextResponse.json(
        {
          error:
            'Confirmation required. Send JSON body: { "confirm": "RESET_ALL_WORKSPACE_DATA" }',
        },
        { status: 400 },
      );
    }

    const result = await resetAllWorkspaceData();

    return NextResponse.json({
      ok: true,
      message: "All workspace job and candidate data has been cleared.",
      ...result,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Workspace reset failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
