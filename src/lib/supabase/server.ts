import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function getServerSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!url.startsWith("https://") || !key.trim()) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.",
    );
  }

  return createClient(url, key);
}

export async function insertScoringRun(
  row: Record<string, unknown>,
): Promise<{ id: string }> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("scoring_runs")
    .insert(row)
    .select("id")
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error("Insert succeeded but no row id returned.");
  return { id: data.id as string };
}

export async function listScoringRuns(): Promise<Record<string, unknown>[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("scoring_runs")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Record<string, unknown>[];
}

export async function upsertScoringRunByScenario(
  row: Record<string, unknown>,
): Promise<{ id: string; inserted: boolean }> {
  const supabase = getServerSupabase();
  const candidate = String(row.candidate_filename).toLowerCase();
  const scenario = String(row.scenario_label).toLowerCase();

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
    if (error) throw error;
    return { id: existing.id as string, inserted: false };
  }

  void candidate;
  void scenario;
  const { id } = await insertScoringRun(row);
  return { id, inserted: true };
}
