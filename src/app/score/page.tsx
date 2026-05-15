import { ScoreManager } from "@/components/score/score-manager";

export const metadata = {
  title: "Score Candidate | Hiring Scorer",
  description: "Upload a resume and score candidates against your active role brief",
};

export default function ScorePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Candidate Scorer
        </h1>
        <p className="mt-2 text-slate-600">
          Upload a resume, run AI scoring against your active role brief, and save
          the evaluation to Supabase.
        </p>
      </div>
      <ScoreManager />
    </div>
  );
}
