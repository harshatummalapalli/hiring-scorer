import type { JobListStats } from "@/types/job";
import { scoreToVerdict } from "@/lib/scoring/recruiter-card";

type ScoreRow = {
  role_brief_id: string | null;
  overall_score: number;
  candidate_id: string | null;
};

type ApplicantRow = {
  job_id: string | null;
  scoring_status: string | null;
};

export function computeJobListStats(
  jobId: string,
  applicants: ApplicantRow[],
  scores: ScoreRow[],
): JobListStats {
  const jobApplicants = applicants.filter((a) => a.job_id === jobId);
  const applicantCount = jobApplicants.length;

  const jobScores = scores.filter((s) => s.role_brief_id === jobId);
  let strongMatches = 0;
  let potentialMatches = 0;

  const seenCandidates = new Set<string>();
  for (const row of jobScores) {
    const cid = row.candidate_id;
    if (cid && seenCandidates.has(cid)) continue;
    if (cid) seenCandidates.add(cid);
    const verdict = scoreToVerdict(Number(row.overall_score ?? 0));
    if (verdict === "STRONG FIT") strongMatches += 1;
    else if (verdict === "POSSIBLE FIT") potentialMatches += 1;
  }

  return { applicantCount, strongMatches, potentialMatches };
}

export function daysSince(isoDate: string): number {
  const created = new Date(isoDate).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, Math.floor((Date.now() - created) / (1000 * 60 * 60 * 24)));
}
