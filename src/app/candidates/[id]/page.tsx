import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function LegacyCandidateDetailPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/candidates?open=${encodeURIComponent(id)}`);
}
