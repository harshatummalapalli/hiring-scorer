import { SavedScoresManager } from "@/components/saved-scores/saved-scores-manager";
import { karta } from "@/lib/brand/karta";

export const metadata = {
  title: "Saved Matches | Karta",
  description: "View and manage saved candidate score cards",
};

export default function SavedScoresPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className={karta.pageTitle}>Saved Scores</h1>
        <p className={`mt-2 ${karta.muted}`}>
          All score cards saved to Supabase. Click a row to open the full
          evaluation. Edit tags and notes inline.
        </p>
      </div>
      <SavedScoresManager />
    </div>
  );
}
