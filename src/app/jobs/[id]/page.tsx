import { JobWorkspace } from "@/components/jobs/job-workspace";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JobWorkspace jobId={id} />
    </div>
  );
}
