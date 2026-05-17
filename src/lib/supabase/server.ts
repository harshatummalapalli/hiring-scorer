import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthenticatedUserId, withCreatedBy } from "@/lib/supabase/created-by";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";

async function getAuthedSupabase(): Promise<{
  supabase: SupabaseClient;
  userId: string;
}> {
  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId(supabase);
  return { supabase, userId };
}

export async function insertScoringRun(
  row: Record<string, unknown>,
): Promise<{ id: string }> {
  const { supabase } = await getAuthedSupabase();
  const { data, error } = await supabase
    .from("scoring_runs")
    .insert(row)
    .select("id")
    .single();

  if (error) throw new Error(error.message ?? "Database insert failed");
  if (!data?.id) throw new Error("Insert succeeded but no row id returned.");
  return { id: data.id as string };
}

export async function insertSavedScore(
  row: Record<string, unknown>,
): Promise<{ id: string }> {
  const { supabase, userId } = await getAuthedSupabase();
  const { data, error } = await supabase
    .from("saved_scores")
    .insert(withCreatedBy(row, userId))
    .select("id")
    .single();

  if (error) throw new Error(error.message ?? "Database insert failed");
  if (!data?.id) throw new Error("Insert succeeded but no row id returned.");
  return { id: data.id as string };
}

export async function listScoringRuns(): Promise<Record<string, unknown>[]> {
  const { supabase } = await getAuthedSupabase();
  const { data, error } = await supabase
    .from("scoring_runs")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message ?? "Database query failed");
  return (data ?? []) as Record<string, unknown>[];
}

export async function upsertScoringRunByScenario(
  row: Record<string, unknown>,
): Promise<{ id: string; inserted: boolean }> {
  const { supabase } = await getAuthedSupabase();

  const { data: existing } = await supabase
    .from("scoring_runs")
    .select("id")
    .ilike("candidate_filename", row.candidate_filename as string)
    .ilike("scenario_label", row.scenario_label as string)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("scoring_runs")
      .update(row)
      .eq("id", existing.id);
    if (error) throw new Error(error.message ?? "Database update failed");
    return { id: existing.id as string, inserted: false };
  }

  const { id } = await insertScoringRun(row);
  return { id, inserted: true };
}
