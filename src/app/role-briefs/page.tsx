import { RoleBriefManager } from "@/components/role-briefs/role-brief-manager";

export const metadata = {
  title: "Role Briefs | Hiring Scorer",
  description: "Create and manage role briefs for candidate scoring",
};

export default function RoleBriefsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Role Brief Manager
        </h1>
        <p className="mt-2 text-slate-600">
          Define role requirements and scoring weights. Set one brief as active
          for candidate evaluation.
        </p>
      </div>
      <RoleBriefManager />
    </div>
  );
}
