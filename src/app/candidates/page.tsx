import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { CandidatesWorkspace } from "@/components/candidates/candidates-workspace";

export const metadata = {
  title: "Candidates | Hiring Scorer",
  description: "Upload, score, and review candidates against your active role brief",
};

function CandidatesFallback() {
  return (
    <div className="flex justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
    </div>
  );
}

export default function CandidatesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Suspense fallback={<CandidatesFallback />}>
        <CandidatesWorkspace />
      </Suspense>
    </div>
  );
}
