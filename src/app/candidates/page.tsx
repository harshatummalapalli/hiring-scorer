import { CandidatesManager } from "@/components/candidates/candidates-manager";

export const metadata = {
  title: "Candidates | Hiring Scorer",
  description: "Talent pool with hiring intelligence profiles",
};

export default function CandidatesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <CandidatesManager />
    </div>
  );
}
