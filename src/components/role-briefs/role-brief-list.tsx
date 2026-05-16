"use client";

import { Check, Pencil, Star, Trash2 } from "lucide-react";
import type { RoleBrief } from "@/types/role-brief";

type RoleBriefListProps = {
  briefs: RoleBrief[];
  activeBriefId: string | null;
  onSetActive: (brief: RoleBrief) => void;
  onEdit: (brief: RoleBrief) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
};

export function RoleBriefList({
  briefs,
  activeBriefId,
  onSetActive,
  onEdit,
  onDelete,
  deletingId,
}: RoleBriefListProps) {
  if (briefs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
        <p className="text-sm font-medium text-slate-700">No role briefs yet</p>
        <p className="mt-1 text-sm text-slate-500">
          Paste a job description above and click Analyse Role.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {briefs.map((brief) => {
        const isActive = brief.id === activeBriefId;
        return (
          <li
            key={brief.id}
            className={`rounded-xl border p-5 transition ${
              isActive
                ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900/10"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-semibold text-slate-900">
                    {brief.title}
                  </h3>
                  {isActive && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-xs font-medium text-white">
                      <Check className="h-3 w-3" aria-hidden />
                      Active
                    </span>
                  )}
                  {brief.title_band && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {brief.title_band}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  {brief.deal_breakers.length} deal breaker
                  {brief.deal_breakers.length === 1 ? "" : "s"} ·{" "}
                  {brief.core_signals.length} core signal
                  {brief.core_signals.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!isActive && (
                  <button
                    type="button"
                    onClick={() => onSetActive(brief)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <Star className="h-3.5 w-3.5" aria-hidden />
                    Set as Active
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onEdit(brief)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(brief.id)}
                  disabled={deletingId === brief.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  {deletingId === brief.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
