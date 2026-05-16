import { RoleBriefManager } from "@/components/role-briefs/role-brief-manager";
import { karta } from "@/lib/brand/karta";

export const metadata = {
  title: "Job Roles | Karta",
  description: "Create and manage job roles for candidate matching",
};

export default function RoleBriefsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
      <div className="mb-12">
        <h1 className={karta.pageTitle}>Job Roles</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#64748B]">
          Paste a full job description — Karta breaks it into must-haves, key
          requirements, and smart match signals.
        </p>
      </div>
      <RoleBriefManager />
    </div>
  );
}
