import { Suspense } from "react";
import { JobsPage } from "@/components/jobs/jobs-page";

export default function JobsRoutePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Suspense
        fallback={
          <div className="flex justify-center py-20 text-sm text-[#64748B]">
            Loading…
          </div>
        }
      >
        <JobsPage />
      </Suspense>
    </div>
  );
}
