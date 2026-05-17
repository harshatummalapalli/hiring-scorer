"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { karta } from "@/lib/brand/karta";

type LinkedInCandidate = {
  id: string;
  display_name: string;
  linkedin_url: string | null;
  summary: string;
};

type JobReachOutTabProps = {
  jobId: string;
};

export function JobReachOutTab({ jobId }: JobReachOutTabProps) {
  const [linkedinCandidates, setLinkedinCandidates] = useState<LinkedInCandidate[]>(
    [],
  );
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/candidates`);
      const json = await res.json();
      if (!res.ok) return;
      const list = (json.candidates as Array<{
        id: string;
        display_name: string;
        source: string;
        linkedin_url: string | null;
        signal_profile: {
          professional_summary?: string;
          skills_verified?: { skill: string }[];
        };
      }>).filter((c) => c.source === "linkedin_profile");

      setLinkedinCandidates(
        list.map((c) => ({
          id: c.id,
          display_name: c.display_name,
          linkedin_url: c.linkedin_url,
          summary:
            c.signal_profile.professional_summary?.trim() ||
            c.signal_profile.skills_verified
              ?.slice(0, 3)
              .map((s) => s.skill)
              .join(", ") ||
            "No signal summary available.",
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-8">
      <section className={`${karta.card} p-8 text-center`}>
        <h2 className="text-xl font-semibold text-[#1E293B]">Coming Soon</h2>
        <p className="mt-3 text-sm text-[#64748B]">
          Outreach tools for LinkedIn profile candidates are being built.
        </p>
      </section>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : linkedinCandidates.length > 0 ? (
        <section className="space-y-3">
          <h3 className={karta.sectionHeading}>LinkedIn profile candidates</h3>
          <ul className="space-y-3">
            {linkedinCandidates.map((c) => (
              <li key={c.id} className={`${karta.card} p-5`}>
                <p className="font-semibold text-[#1E293B]">{c.display_name}</p>
                {c.linkedin_url && (
                  <a
                    href={c.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block text-sm text-[#0D9488] hover:underline"
                  >
                    {c.linkedin_url}
                  </a>
                )}
                <p className="mt-2 text-sm text-[#64748B]">{c.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
