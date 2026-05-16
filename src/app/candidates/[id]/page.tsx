import { CandidateDetailPage } from "@/components/candidates/candidate-detail-page";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return {
    title: `Candidate | Hiring Scorer`,
    description: `Candidate profile ${id}`,
  };
}

export default async function CandidateProfilePage({ params }: PageProps) {
  const { id } = await params;
  return <CandidateDetailPage candidateId={id} />;
}
