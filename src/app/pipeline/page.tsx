import { PipelineManager } from "@/components/pipeline/pipeline-manager";

export const metadata = {
  title: "Pipeline | Hiring Scorer",
  description: "Shortlisted candidates organised by role brief",
};

export default function PipelinePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <PipelineManager />
    </div>
  );
}
