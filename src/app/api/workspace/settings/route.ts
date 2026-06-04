import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { resolveShortlistColumns } from "@/lib/shortlist/resolve-columns";
import type { ShortlistColumn } from "@/lib/shortlist/default-columns";
import {
  getShortlistColumns,
  saveShortlistColumns,
} from "@/lib/workspace/shortlist-settings";

export async function GET() {
  try {
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

    const columns = await getShortlistColumns(supabase, user.id);
    return NextResponse.json({ shortlist_columns: columns });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load workspace settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
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

    const body = (await request.json()) as {
      shortlist_columns?: ShortlistColumn[] | { columns: ShortlistColumn[] };
    };

    let columns: ShortlistColumn[] | undefined;
    if (Array.isArray(body.shortlist_columns)) {
      columns = body.shortlist_columns;
    } else if (
      body.shortlist_columns &&
      typeof body.shortlist_columns === "object" &&
      Array.isArray(body.shortlist_columns.columns)
    ) {
      columns = resolveShortlistColumns(body.shortlist_columns);
    }

    if (!columns) {
      return NextResponse.json(
        { error: "shortlist_columns required." },
        { status: 400 },
      );
    }

    const normalized = resolveShortlistColumns({ columns });
    const saved = await saveShortlistColumns(supabase, user.id, normalized);
    return NextResponse.json({ shortlist_columns: saved });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to save workspace settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
