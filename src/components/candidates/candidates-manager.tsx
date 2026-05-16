"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { parseResumeFile } from "@/lib/resume/parse-resume";
import { stripPII } from "@/lib/resume/strip-pii";
import type { CandidateRow } from "@/types/candidate";

export function CandidatesManager() {
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/candidates");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setCandidates(json.candidates as CandidateRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const raw = await parseResumeFile(file);
        const resumeText = stripPII(raw);
        const res = await fetch("/api/candidates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resumeText,
            resumeFilename: file.name,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(
            json.hint
              ? `${json.error} ${json.hint}`
              : (json.error ?? "Upload failed"),
          );
        }
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a1628] sm:text-3xl">
            Candidates
          </h1>
          <p className="mt-2 text-slate-600">
            Your talent pool with hiring intelligence profiles. Open a candidate
            for a LinkedIn-style view with scores and notes.
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="mb-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <UserPlus className="h-4 w-4" aria-hidden />
          Add candidate
        </h2>
        <label
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 transition hover:border-slate-400 hover:bg-slate-100 ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            multiple
            className="sr-only"
            disabled={uploading}
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <span className="text-sm font-medium text-slate-700">
            Drop resumes here or click to upload
          </span>
          <span className="mt-1 text-xs text-slate-500">PDF, Word, or plain text</span>
        </label>
        {uploading && (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Building signal profile…
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : candidates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-600">
          No candidates yet. Upload a resume to create your first profile.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {candidates.map((c) => {
            const profile = c.signal_profile;
            return (
              <li key={c.id}>
                <Link
                  href={`/candidates/${c.id}`}
                  className="flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50"
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white"
                    aria-hidden
                  >
                    {c.display_name
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#0a1628]">
                      {c.display_name}
                    </p>
                    <p className="truncate text-sm text-slate-500">
                      {profile.most_recent_title}
                      {profile.location ? ` · ${profile.location}` : ""}
                    </p>
                  </div>
                  <div className="hidden text-right text-sm text-slate-500 sm:block">
                    <p>{profile.total_years_experience}</p>
                    <p className="text-xs">{profile.career_pattern}</p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
