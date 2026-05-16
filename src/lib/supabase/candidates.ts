import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  CandidateActivity,
  CandidateDetail,
  CandidateNote,
  CandidateRow,
  CandidateRoleFitScore,
  CandidateSignalProfile,
  CandidateStage,
} from "@/types/candidate";
import { normalizeSignalProfile } from "@/lib/candidates/build-signal-profile";
import { scoreToVerdict } from "@/lib/scoring/recruiter-card";
import type { CandidateScoreResult } from "@/types/score";

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

function rowToCandidate(row: Record<string, unknown>): CandidateRow {
  const filename = String(row.resume_filename ?? "candidate.pdf");
  const resumeText = String(row.resume_text ?? "");
  return {
    id: String(row.id),
    display_name: String(row.display_name),
    resume_filename: row.resume_filename != null ? String(row.resume_filename) : null,
    resume_text: resumeText,
    signal_profile: normalizeSignalProfile(
      row.signal_profile,
      resumeText,
      filename,
    ),
    stage: (row.stage as CandidateStage) ?? "new",
    tag: row.tag != null ? String(row.tag) : null,
    activity: Array.isArray(row.activity)
      ? (row.activity as CandidateActivity[])
      : [],
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function listCandidates(): Promise<CandidateRow[]> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    if (error.message?.toLowerCase().includes("does not exist")) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => rowToCandidate(r as Record<string, unknown>));
}

export async function getCandidateById(id: string): Promise<CandidateDetail | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const candidate = rowToCandidate(data as Record<string, unknown>);

  const { data: notes, error: notesError } = await supabase
    .from("candidate_notes")
    .select("*")
    .eq("candidate_id", id)
    .order("created_at", { ascending: false });

  if (notesError && !notesError.message?.includes("does not exist")) {
    throw new Error(notesError.message);
  }

  const { data: byCandidateId, error: scoresError } = await supabase
    .from("saved_scores")
    .select("*")
    .eq("candidate_id", id)
    .order("created_at", { ascending: false });

  if (scoresError && !scoresError.message?.includes("candidate_id")) {
    throw new Error(scoresError.message);
  }

  let scoreRows = byCandidateId ?? [];
  if (candidate.resume_filename) {
    const { data: byFilename } = await supabase
      .from("saved_scores")
      .select("*")
      .ilike("candidate_filename", candidate.resume_filename)
      .order("created_at", { ascending: false });
    const seen = new Set(scoreRows.map((r) => String((r as { id: string }).id)));
    for (const row of byFilename ?? []) {
      const rid = String((row as { id: string }).id);
      if (!seen.has(rid)) {
        seen.add(rid);
        scoreRows.push(row);
      }
    }
    scoreRows.sort(
      (a, b) =>
        new Date(String((b as { created_at: string }).created_at)).getTime() -
        new Date(String((a as { created_at: string }).created_at)).getTime(),
    );
  }

  const role_fit_scores: CandidateRoleFitScore[] = scoreRows.map((s) => {
    const row = s as Record<string, unknown>;
    const overall = Number(row.overall_score ?? 0);
    return {
      id: String(row.id),
      role_brief_id: row.role_brief_id != null ? String(row.role_brief_id) : null,
      role_brief_title:
        row.role_brief_title != null
          ? String(row.role_brief_title)
          : null,
      overall_score: overall,
      verdict: scoreToVerdict(overall),
      created_at: String(row.created_at),
      score_snapshot: (row.score_snapshot as CandidateScoreResult) ?? null,
      role_brief_snapshot: row.role_brief_snapshot,
    };
  });

  return {
    ...candidate,
    notes: (notes ?? []).map((n) => {
      const row = n as Record<string, unknown>;
      return {
        id: String(row.id),
        candidate_id: String(row.candidate_id),
        body: String(row.body),
        created_at: String(row.created_at),
      } satisfies CandidateNote;
    }),
    role_fit_scores,
  };
}

export async function insertCandidate(row: {
  display_name: string;
  resume_filename: string | null;
  resume_text: string;
  signal_profile: CandidateSignalProfile;
  activity: CandidateActivity[];
}): Promise<{ id: string }> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("candidates")
    .insert({
      display_name: row.display_name,
      resume_filename: row.resume_filename,
      resume_text: row.resume_text,
      signal_profile: row.signal_profile,
      activity: row.activity,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("Insert succeeded but no id returned.");
  return { id: data.id as string };
}

export async function updateCandidate(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const supabase = getServerSupabase();
  const { error } = await supabase
    .from("candidates")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function insertCandidateNote(
  candidateId: string,
  body: string,
): Promise<CandidateNote> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("candidate_notes")
    .insert({ candidate_id: candidateId, body })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    candidate_id: String(row.candidate_id),
    body: String(row.body),
    created_at: String(row.created_at),
  };
}
