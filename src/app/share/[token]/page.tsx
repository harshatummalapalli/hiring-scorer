import { KARTA } from "@/lib/brand/karta";
import { loadPublicShortlist } from "@/lib/share/load-public-shortlist";
import { CandidatePitchCard } from "@/components/pipeline/candidate-pitch-card";
import "./share.css";

type SharePageProps = {
  params: Promise<{ token: string }>;
};

function formatPreparedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default async function ShareShortlistPage({ params }: SharePageProps) {
  const { token } = await params;
  const data = await loadPublicShortlist(token);

  if (!data) {
    return (
      <main className="share-page mx-auto min-h-screen max-w-[680px] bg-white px-6 py-16">
        <p className="text-center text-lg font-medium text-[#1E293B]">
          This shortlist is no longer available
        </p>
      </main>
    );
  }

  const headerTitle = data.companyName?.trim() || "Shortlist";

  return (
    <main className="share-page mx-auto min-h-screen max-w-[680px] bg-white px-6 py-10 pb-16">
      <header className="border-b border-slate-200 pb-8">
        <p className="text-sm font-medium text-[#64748B]">{headerTitle}</p>
        <h1 className="mt-1 text-2xl font-medium text-[#1E293B]">
          {data.jobTitle}
        </h1>
        <p className="mt-3 text-sm text-[#64748B]">
          Prepared by {KARTA.name} · {formatPreparedDate(data.preparedAt)}
        </p>
        <p className="mt-2 text-sm text-[#0D9488]">{KARTA.tagline}</p>
      </header>

      <div className="mt-8 space-y-0">
        {data.candidates.length === 0 ? (
          <p className="text-sm text-[#64748B]">
            No candidates on this shortlist yet.
          </p>
        ) : (
          data.candidates.map((entry, index) => (
            <article
              key={entry.pipeline.id}
              className={
                index > 0 ? "border-t border-slate-200 pt-8 mt-8" : ""
              }
            >
              <h2 className="text-lg font-medium text-[#1E293B]">
                {entry.pipeline.candidate_name}
              </h2>
              <p className="mt-1 text-sm text-[#64748B]">
                {[entry.currentTitle, entry.yearsExperience, entry.location]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="mt-4">
                <CandidatePitchCard
                  candidate={entry.pipeline}
                  score={entry.score}
                />
              </div>
            </article>
          ))
        )}
      </div>

      <footer className="share-footer mt-12 border-t border-slate-200 pt-8 text-center text-sm text-[#64748B]">
        This shortlist was prepared using {KARTA.name} — AI-powered candidate
        intelligence.
      </footer>
    </main>
  );
}
