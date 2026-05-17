import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { TalentPoolWorkspace } from "@/components/talent-pool/talent-pool-workspace";

export default function TalentPoolPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Suspense
        fallback={
          <div className="flex justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        }
      >
        <TalentPoolWorkspace />
      </Suspense>
    </div>
  );
}
