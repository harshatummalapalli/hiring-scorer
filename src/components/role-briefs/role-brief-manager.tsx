"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  RoleBriefCreator,
  roleBriefToCreatorState,
} from "@/components/role-briefs/role-brief-creator";
import { RoleBriefList } from "@/components/role-briefs/role-brief-list";
import { JobLimitModal } from "@/components/workspace/job-limit-modal";
import { useActiveRoleBrief } from "@/contexts/active-role-brief-context";
import { getErrorMessage } from "@/lib/errors";
import {
  buildFullBriefPayload,
  buildLegacyBriefPayload,
  isMissingClientContextColumnError,
  isMissingJobArchitectureColumnError,
  isMissingScoringPromptColumnError,
  isMissingJdAnalysisMetaColumnError,
  isMissingV2ColumnError,
  stripClientContextColumns,
  stripJdAnalysisMetaColumns,
  stripJobArchitectureColumns,
  stripScoringPromptColumns,
} from "@/lib/role-brief/insert-brief-payload";
import type { JobPostingFields } from "@/types/job-posting";
import {
  getAuthenticatedUserId,
  withCreatedBy,
} from "@/lib/supabase/created-by";
import { createSupabaseClient, getSupabaseConfigError } from "@/lib/supabase/client";
import type {
  RoleBrief,
  RoleBriefAnalysis,
  RoleBriefAnalysisMeta,
} from "@/types/role-brief";
import { parseRoleBriefRow } from "@/types/role-brief";

async function upsertRoleBrief(
  title: string,
  jobDescription: string,
  analysis: RoleBriefAnalysis,
  analysisMeta: RoleBriefAnalysisMeta,
  editingId: string | null,
  jobPosting?: JobPostingFields,
): Promise<RoleBrief> {
  const supabase = createSupabaseClient();

  const attempt = async (row: Record<string, unknown>) => {
    if (editingId) {
      const { data, error } = await supabase
        .from("role_briefs")
        .update(row)
        .eq("id", editingId)
        .select()
        .single();
      if (error) throw error;
      if (!data) throw new Error("Update succeeded but no row returned.");
      return parseRoleBriefRow(data as Record<string, unknown>);
    }
    const { data, error } = await supabase
      .from("role_briefs")
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new Error("Insert succeeded but no row returned.");
    return parseRoleBriefRow(data as Record<string, unknown>);
  };

  let full: Record<string, unknown> = buildFullBriefPayload(
    title,
    jobDescription,
    analysis,
    !editingId,
    analysisMeta,
    jobPosting,
  );
  if (!editingId) {
    const userId = await getAuthenticatedUserId(supabase);
    full = withCreatedBy(full, userId);
  }
  try {
    return await attempt(full);
  } catch (err) {
    const msg = getErrorMessage(err, "");
    if (isMissingJobArchitectureColumnError(msg)) {
      try {
        return await attempt(stripJobArchitectureColumns(full));
      } catch (jobErr) {
        const jobMsg = getErrorMessage(jobErr, "");
        if (!isMissingScoringPromptColumnError(jobMsg)) throw jobErr;
      }
    }
    if (isMissingJdAnalysisMetaColumnError(msg)) {
      try {
        return await attempt(stripJdAnalysisMetaColumns(full));
      } catch (metaErr) {
        const metaMsg = getErrorMessage(metaErr, "");
        if (!isMissingScoringPromptColumnError(metaMsg)) throw metaErr;
      }
    }
    if (isMissingClientContextColumnError(msg)) {
      try {
        return await attempt(stripClientContextColumns(full));
      } catch (clientErr) {
        const clientMsg = getErrorMessage(clientErr, "");
        if (!isMissingV2ColumnError(clientMsg)) throw clientErr;
      }
    }
    if (isMissingScoringPromptColumnError(msg)) {
      try {
        return await attempt(stripScoringPromptColumns(full));
      } catch (retryErr) {
        const retryMsg = getErrorMessage(retryErr, "");
        if (isMissingJdAnalysisMetaColumnError(retryMsg)) {
          return await attempt(stripJdAnalysisMetaColumns(full));
        }
        if (isMissingClientContextColumnError(retryMsg)) {
          return await attempt(stripClientContextColumns(full));
        }
        if (isMissingV2ColumnError(retryMsg)) {
          return await attempt(
            buildLegacyBriefPayload(title, jobDescription, analysis),
          );
        }
        throw retryErr;
      }
    }
    if (isMissingV2ColumnError(msg)) {
      return await attempt(
        buildLegacyBriefPayload(title, jobDescription, analysis),
      );
    }
    throw err;
  }
}

export function RoleBriefManager() {
  const { activeBriefId, setActiveBrief, syncActiveBriefFromList } =
    useActiveRoleBrief();

  const [briefs, setBriefs] = useState<RoleBrief[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creatorKey, setCreatorKey] = useState(0);
  const [editJobDescription, setEditJobDescription] = useState("");
  const [editAnalysis, setEditAnalysis] = useState<RoleBriefAnalysis | null>(
    null,
  );
  const [editTitle, setEditTitle] = useState("");
  const [editAnalysisMeta, setEditAnalysisMeta] =
    useState<RoleBriefAnalysisMeta | null>(null);
  const [editAnalysedJobDescription, setEditAnalysedJobDescription] =
    useState("");
  const [editJobPosting, setEditJobPosting] = useState<
    JobPostingFields | undefined
  >(undefined);

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [recommendationsRefreshToken, setRecommendationsRefreshToken] =
    useState(0);
  const [showJobLimitModal, setShowJobLimitModal] = useState(false);

  const configError = getSupabaseConfigError();

  const fetchBriefs = useCallback(async () => {
    setError(null);
    if (getSupabaseConfigError()) {
      setLoading(false);
      return;
    }

    try {
      const supabase = createSupabaseClient();
      const { data, error: fetchError } = await supabase
        .from("role_briefs")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      const rows = (data ?? []).map((r) =>
        parseRoleBriefRow(r as Record<string, unknown>),
      );
      setBriefs(rows);
      syncActiveBriefFromList(rows);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load role briefs"));
    } finally {
      setLoading(false);
    }
  }, [syncActiveBriefFromList]);

  useEffect(() => {
    void fetchBriefs();
  }, [fetchBriefs]);

  const resetCreator = () => {
    setEditingId(null);
    setEditJobDescription("");
    setEditAnalysis(null);
    setEditTitle("");
    setEditAnalysisMeta(null);
    setEditAnalysedJobDescription("");
    setEditJobPosting(undefined);
    setCreatorKey((k) => k + 1);
  };

  const handleSave = async (data: {
    title: string;
    jobDescription: string;
    analysis: RoleBriefAnalysis;
    analysisMeta: RoleBriefAnalysisMeta;
    jobPosting: JobPostingFields;
  }) => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      let saved: RoleBrief;
      if (!editingId) {
        const res = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) {
          if (json.code === "JOB_LIMIT_REACHED") {
            setShowJobLimitModal(true);
            return;
          }
          throw new Error(json.error ?? "Failed to save role brief");
        }
        saved = json.job as RoleBrief;
      } else {
        saved = await upsertRoleBrief(
          data.title,
          data.jobDescription,
          data.analysis,
          data.analysisMeta,
          editingId,
          data.jobPosting,
        );
      }
      setSuccess(`Saved “${saved.title}”.`);
      if (!editingId) {
        setActiveBrief(saved);
        setRecommendationsRefreshToken((t) => t + 1);
      }
      resetCreator();
      await fetchBriefs();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save role brief"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (brief: RoleBrief) => {
    const state = roleBriefToCreatorState(brief);
    setEditingId(brief.id);
    setEditJobDescription(state.jobDescription);
    setEditAnalysis(state.analysis);
    setEditTitle(state.title);
    setEditAnalysisMeta(state.analysisMeta);
    setEditAnalysedJobDescription(state.analysedJobDescription);
    setCreatorKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this job role? This cannot be undone.")) return;

    setDeletingId(id);
    setError(null);

    try {
      const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to delete job role");

      if (activeBriefId === id) setActiveBrief(null);
      if (editingId === id) resetCreator();
      await fetchBriefs();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete job role"));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-12">
      {configError && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <p className="font-medium">Supabase not connected</p>
          <p className="mt-1">{configError}</p>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          {success}
        </div>
      )}

      <RoleBriefCreator
        key={creatorKey}
        initialJobDescription={editJobDescription}
        initialAnalysis={editAnalysis}
        initialTitle={editTitle}
        initialJobPosting={editJobPosting}
        initialAnalysisMeta={editAnalysisMeta}
        initialAnalysedJobDescription={editAnalysedJobDescription}
        editingId={editingId}
        onSave={handleSave}
        isSaving={isSaving}
      />

      <section>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[#1E293B]">Your Job Roles</h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Set a job role as active to match candidates against it.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading job roles…</span>
          </div>
        ) : (
          <RoleBriefList
            briefs={briefs}
            activeBriefId={activeBriefId}
            recommendationsRefreshToken={recommendationsRefreshToken}
            onSetActive={(brief) => {
              setActiveBrief(brief);
              setRecommendationsRefreshToken((t) => t + 1);
            }}
            onEdit={handleEdit}
            onDelete={handleDelete}
            deletingId={deletingId}
          />
        )}
      </section>

      <JobLimitModal
        open={showJobLimitModal}
        onClose={() => setShowJobLimitModal(false)}
      />
    </div>
  );
}
