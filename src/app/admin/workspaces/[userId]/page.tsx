import { AdminWorkspaceView } from "@/components/admin/admin-workspace-view";

type PageProps = {
  params: Promise<{ userId: string }>;
};

export default async function AdminWorkspacePage({ params }: PageProps) {
  const { userId } = await params;
  return <AdminWorkspaceView userId={userId} />;
}
