import { SavedScoresManager } from "@/components/saved-scores/saved-scores-manager";

export const metadata = {
  title: "Saved Scores | Hiring Scorer",
  description: "View and manage saved candidate score cards",
};

export default function SavedScoresPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Saved Scores
        </h1>
        <p className="mt-2 text-slate-600">
          All score cards saved to Supabase. Click a row to open the full
          evaluation. Edit tags and notes inline.
        </p>
      </div>
      <SavedScoresManager />
    </div>
  );
}
