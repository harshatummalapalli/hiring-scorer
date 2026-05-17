"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type SuccessPageProps = {
  params: Promise<{ token: string }>;
};

export default function ApplySuccessPage({ params }: SuccessPageProps) {
  const [jobTitle, setJobTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void params.then(async ({ token }) => {
      try {
        const res = await fetch(`/api/apply/${encodeURIComponent(token)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Job not found");
        setJobTitle(json.job.title as string);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load job");
      } finally {
        setLoading(false);
      }
    });
  }, [params]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-[#1E293B]">
        Application received
      </h1>
      <p className="mt-3 text-sm text-[#64748B]">
        Thank you for applying to {jobTitle}. The hiring team will review your
        resume shortly.
      </p>
    </div>
  );
}
