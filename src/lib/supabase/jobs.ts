import type { SupabaseClient } from "@supabase/supabase-js";
import { computeJobListStats, daysSince } from "@/lib/jobs/stats";
import { createSupabaseServerClient } from "@/lib/supabase/server-auth";
import { parseRoleBriefRow } from "@/types/role-brief";
import type { Job, JobListItem } from "@/types/job";

async function getServerSupabase(): Promise<SupabaseClient> {
  return createSupabaseServerClient();
}

export async function listJobsWithStats(
  userId: string,
): Promise<JobListItem[]> {
  const supabase = await getServerSupabase();
  const [jobsRes, applicantsRes, scoresRes] = await Promise.all([
    supabase
      .from("role_briefs")
      .select("*")
      .eq("created_by", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("candidates")
      .select("job_id, scoring_status")
      .eq("created_by", userId),
    supabase
      .from("saved_scores")
      .select("role_brief_id, overall_score, candidate_id")
      .eq("created_by", userId),
  ]);

  if (jobsRes.error) throw new Error(jobsRes.error.message);

  const applicants = (applicantsRes.data ?? []) as {
    job_id: string | null;
    scoring_status: string | null;
  }[];
  const scores = (scoresRes.data ?? []) as {
    role_brief_id: string | null;
    overall_score: number;
    candidate_id: string | null;
  }[];

  return (jobsRes.data ?? []).map((row) => {
    const job = parseRoleBriefRow(row as Record<string, unknown>) as Job;
    const stats = computeJobListStats(job.id, applicants, scores);
    return {
      ...job,
      ...stats,
      daysSinceCreated: daysSince(job.created_at),
    };
  });
}

export async function getJobById(id: string): Promise<Job | null> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("role_briefs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return parseRoleBriefRow(data as Record<string, unknown>) as Job;
}

export async function updateJob(
  id: string,
  patch: Record<string, unknown>,
): Promise<Job> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from("role_briefs")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return parseRoleBriefRow(data as Record<string, unknown>) as Job;
}
