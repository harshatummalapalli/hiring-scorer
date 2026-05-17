"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { AdminWorkspaceDetail } from "@/lib/admin/queries";
import { karta } from "@/lib/brand/karta";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type AdminWorkspaceViewProps = {
  userId: string;
};

export function AdminWorkspaceView({ userId }: AdminWorkspaceViewProps) {
  const [detail, setDetail] = useState<AdminWorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/workspaces/${userId}`);
        if (res.status === 404) {
          setError("Workspace not found");
          return;
        }
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed to load workspace");
        setDetail(json as AdminWorkspaceDetail);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <p className="text-sm text-red-600" role="alert">
        {error ?? "Not found"}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm font-medium text-[#0D9488] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          All workspaces
        </Link>
        <h2 className={`mt-4 ${karta.pageTitle}`}>{detail.ownerName}</h2>
        <p className="mt-1 text-sm text-[#64748B]">{detail.ownerEmail}</p>
        {detail.companyName ? (
          <p className="text-sm text-[#64748B]">{detail.companyName}</p>
        ) : null}
        <p className="mt-2 text-xs text-[#94A3B8]">
          Read-only view · Workspace created{" "}
          {formatDateTime(detail.createdAt)}
        </p>
      </div>

      <section>
        <h3 className={karta.sectionHeading}>Jobs ({detail.jobs.length})</h3>
        <div className={`mt-3 overflow-x-auto ${karta.card}`}>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase text-[#64748B]">
              <tr>
                <th className="px-4 py-2">Title</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Company</th>
                <th className="px-4 py-2 text-right">Applications</th>
                <th className="px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {detail.jobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-[#64748B]">
                    No jobs
                  </td>
                </tr>
              ) : (
                detail.jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="px-4 py-2 font-medium text-[#1E293B]">
                      {j.title}
                    </td>
                    <td className="px-4 py-2 text-[#64748B]">
                      {j.status ?? "active"}
                    </td>
                    <td className="px-4 py-2 text-[#64748B]">
                      {j.companyName ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {j.applicationCount ?? 0}
                    </td>
                    <td className="px-4 py-2 text-[#64748B]">
                      {formatDateTime(j.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className={karta.sectionHeading}>
          Candidates ({detail.candidates.length}
          {detail.candidates.length >= 100 ? "+" : ""})
        </h3>
        <div className={`mt-3 overflow-x-auto ${karta.card}`}>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase text-[#64748B]">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Source</th>
                <th className="px-4 py-2">Scoring</th>
                <th className="px-4 py-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {detail.candidates.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-[#64748B]">
                    No candidates
                  </td>
                </tr>
              ) : (
                detail.candidates.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 font-medium text-[#1E293B]">
                      {c.displayName}
                    </td>
                    <td className="px-4 py-2 text-[#64748B]">
                      {c.source ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-[#64748B]">
                      {c.scoringStatus ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-[#64748B]">
                      {formatDateTime(c.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className={karta.sectionHeading}>Recent activity</h3>
        <div className={`mt-3 ${karta.card} divide-y divide-slate-100`}>
          {detail.activity.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-[#64748B]">
              No activity logged yet
            </p>
          ) : (
            detail.activity.map((a) => (
              <div key={a.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-[#334155]">{a.action}</span>
                  <span className="text-xs text-[#94A3B8]">
                    {formatDateTime(a.createdAt)}
                  </span>
                </div>
                {a.resourceType ? (
                  <p className="mt-0.5 text-xs text-[#64748B]">
                    {a.resourceType}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
