"use client";

import { Check, Pencil, Star, Trash2 } from "lucide-react";
import { PromptStatusBadge } from "@/components/role-briefs/prompt-status-badge";
import type { RoleBrief } from "@/types/role-brief";
import { karta } from "@/lib/brand/karta";
import { TalentPoolRecommendations } from "@/components/role-briefs/talent-pool-recommendations";

type RoleBriefListProps = {
  briefs: RoleBrief[];
  activeBriefId: string | null;
  recommendationsRefreshToken: number;
  onSetActive: (brief: RoleBrief) => void;
  onEdit: (brief: RoleBrief) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
};

export function RoleBriefList({
  briefs,
  activeBriefId,
  recommendationsRefreshToken,
  onSetActive,
  onEdit,
  onDelete,
  deletingId,
}: RoleBriefListProps) {
  if (briefs.length === 0) {
    return (
      <div className={`${karta.card} border-dashed px-6 py-12 text-center`}>
        <p className="text-[15px] font-medium text-[#334155]">No job roles yet</p>
        <p className="mt-1 text-sm text-[#64748B]">
          Add your first job role to get started — paste a JD and Karta will break
          it down instantly.
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
            className={`rounded-lg border bg-white p-5 transition ${
              isActive
                ? "border-l-4 border-l-[#0D9488] border-[#F1F5F9] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                : "border-[#F1F5F9] shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:border-slate-200"
            }`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-semibold text-[#1E293B]">
                    {brief.title}
                  </h3>
                  <PromptStatusBadge
                    ready={Boolean(brief.scoring_prompt?.trim())}
                  />
                  {isActive && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#0D9488] px-2.5 py-0.5 text-xs font-semibold text-white">
                      <Check className="h-3 w-3" aria-hidden />
                      Active
                    </span>
                  )}
                  {brief.title_band && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-[#64748B]">
                      {brief.title_band}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-[#64748B]">
                  {brief.deal_breakers.length} must-haves ·{" "}
                  {brief.core_signals.length} key requirements
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {!isActive && (
                  <button
                    type="button"
                    onClick={() => onSetActive(brief)}
                    className={`inline-flex items-center gap-1.5 ${karta.btnSecondary} px-3 py-1.5 text-sm`}
                  >
                    <Star className="h-3.5 w-3.5" aria-hidden />
                    Set as Active Role
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onEdit(brief)}
                  className={`inline-flex items-center gap-1.5 ${karta.btnSecondary} px-3 py-1.5 text-sm`}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(brief.id)}
                  disabled={deletingId === brief.id}
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  {deletingId === brief.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </li>
        );
      })}
      {activeBriefId && (() => {
        const activeBrief = briefs.find((b) => b.id === activeBriefId);
        if (!activeBrief) return null;
        return (
          <li key={`recs-${activeBrief.id}`} className="list-none">
            <TalentPoolRecommendations
              roleBrief={activeBrief}
              refreshToken={recommendationsRefreshToken}
            />
          </li>
        );
      })()}
    </ul>
  );
}
