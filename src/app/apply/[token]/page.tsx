"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { karta } from "@/lib/brand/karta";
import { parseResumeFile } from "@/lib/resume/parse-resume";

type ApplyPageProps = {
  params: Promise<{ token: string }>;
};

export default function ApplyPage({ params }: ApplyPageProps) {
  const [token, setToken] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    void params.then(async ({ token: t }) => {
      setToken(t);
      try {
        const res = await fetch(`/api/apply/${encodeURIComponent(t)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Job not found");
        setJobTitle(json.job.title as string);
        setCompanyName(json.job.company_name as string | null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load job");
      } finally {
        setLoading(false);
      }
    });
  }, [params]);

  const submit = async (resumeText: string, resumeFilename: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/apply/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          resumeFilename,
          displayName: name.trim() || undefined,
          applicationEmail: email.trim() || undefined,
          applicationPhone: phone.trim() || undefined,
          applicationLocation: location.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Submission failed");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-[#1E293B]">Application received</h1>
        <p className="mt-3 text-sm text-[#64748B]">
          Thank you for applying to {jobTitle}. The hiring team will review your
          resume shortly.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-semibold text-[#1E293B]">{jobTitle}</h1>
      {companyName && (
        <p className="mt-1 text-sm text-[#64748B]">{companyName}</p>
      )}
      <p className="mt-4 text-sm text-[#64748B]">
        Submit your resume to apply. No account required.
      </p>

      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <form
        className={`mt-8 space-y-4 ${karta.card} p-6`}
        onSubmit={(e) => e.preventDefault()}
      >
        <label className="block text-sm font-medium text-[#334155]">
          Full name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`mt-1 w-full ${karta.input}`}
          />
        </label>
        <label className="block text-sm font-medium text-[#334155]">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`mt-1 w-full ${karta.input}`}
          />
        </label>
        <label className="block text-sm font-medium text-[#334155]">
          Phone
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={`mt-1 w-full ${karta.input}`}
          />
        </label>
        <label className="block text-sm font-medium text-[#334155]">
          Location
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={`mt-1 w-full ${karta.input}`}
          />
        </label>
        <label
          className={`flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-slate-300 py-8 text-sm text-slate-600 ${submitting ? "opacity-60" : ""}`}
        >
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            className="sr-only"
            disabled={submitting}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              void (async () => {
                const text = await parseResumeFile(file);
                await submit(text, file.name);
              })();
            }}
          />
          Upload resume (PDF, Word, or text)
        </label>
        {submitting && (
          <p className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Submitting…
          </p>
        )}
      </form>
    </div>
  );
}
