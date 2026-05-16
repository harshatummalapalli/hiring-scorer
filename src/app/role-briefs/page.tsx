import { RoleBriefManager } from "@/components/role-briefs/role-brief-manager";

export const metadata = {
  title: "Role Briefs | Hiring Scorer",
  description: "Create and manage role briefs for candidate scoring",
};

export default function RoleBriefsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
      <div className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Role Briefs
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
          Paste a full job description. We analyse it into deal breakers, core
          signals, and more — then use the active brief when scoring candidates.
        </p>
      </div>
      <RoleBriefManager />
    </div>
  );
}
