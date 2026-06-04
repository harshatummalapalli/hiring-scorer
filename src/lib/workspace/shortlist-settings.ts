import type { SupabaseClient } from "@supabase/supabase-js";
import {
  columnsToConfig,
  resolveShortlistColumns,
} from "@/lib/shortlist/resolve-columns";
import type { ShortlistColumn } from "@/lib/shortlist/default-columns";

export async function getShortlistColumns(
  supabase: SupabaseClient,
  userId: string,
): Promise<ShortlistColumn[]> {
  const { data, error } = await supabase
    .from("workspace_settings")
    .select("shortlist_columns")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("does not exist") || msg.includes("shortlist_columns")) {
      return resolveShortlistColumns(null);
    }
    throw new Error(error.message);
  }

  return resolveShortlistColumns(data?.shortlist_columns ?? null);
}

export async function saveShortlistColumns(
  supabase: SupabaseClient,
  userId: string,
  columns: ShortlistColumn[],
): Promise<ShortlistColumn[]> {
  const payload = columnsToConfig(columns);

  const { data: existing } = await supabase
    .from("workspace_settings")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("workspace_settings")
      .update({
        shortlist_columns: payload,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("workspace_settings").insert({
      user_id: userId,
      settings: {},
      shortlist_columns: payload,
    });
    if (error) throw new Error(error.message);
  }

  return resolveShortlistColumns(payload);
}
