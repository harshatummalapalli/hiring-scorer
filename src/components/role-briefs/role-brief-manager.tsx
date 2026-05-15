"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { useActiveRoleBrief } from "@/contexts/active-role-brief-context";
import { getErrorMessage } from "@/lib/errors";
import { createSupabaseClient, getSupabaseConfigError } from "@/lib/supabase/client";
import type { RoleBrief, RoleBriefFormValues } from "@/types/role-brief";
import {
  defaultFormValues,
  formValuesToPayload,
  roleBriefToFormValues,
} from "@/types/role-brief";
import { RoleBriefForm } from "./role-brief-form";
import { RoleBriefList } from "./role-brief-list";

export function RoleBriefManager() {
  const { activeBriefId, setActiveBrief, syncActiveBriefFromList } =
    useActiveRoleBrief();

  const [briefs, setBriefs] = useState<RoleBrief[]>([]);
  const [formValues, setFormValues] =
    useState<RoleBriefFormValues>(defaultFormValues);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const configError = getSupabaseConfigError();

  const fetchBriefs = useCallback(async () => {
    setError(null);
    const envError = getSupabaseConfigError();
    if (envError) {
      setError(envError);
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

      const rows = (data ?? []) as RoleBrief[];
      setBriefs(rows);
      syncActiveBriefFromList(rows);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load role briefs"));
    } finally {
      setLoading(false);
    }
  }, [syncActiveBriefFromList]);

  useEffect(() => {
    fetchBriefs();
  }, [fetchBriefs]);

  const resetForm = () => {
    setFormValues(defaultFormValues);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = createSupabaseClient();
      const payload = formValuesToPayload(formValues);

      if (editingId) {
        const { data, error: updateError } = await supabase
          .from("role_briefs")
          .update(payload)
          .eq("id", editingId)
          .select()
          .single();

        if (updateError) throw updateError;
        if (!data) throw new Error("Update succeeded but no row was returned.");
        setSuccess(`Updated “${data.title}”.`);
      } else {
        const { data, error: insertError } = await supabase
          .from("role_briefs")
          .insert(payload)
          .select()
          .single();

        if (insertError) throw insertError;
        if (!data) throw new Error("Insert succeeded but no row was returned.");
        setSuccess(`Created “${data.title}”.`);
      }

      resetForm();
      await fetchBriefs();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save role brief"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (brief: RoleBrief) => {
    setEditingId(brief.id);
    setFormValues(roleBriefToFormValues(brief));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this role brief? This cannot be undone.")) return;

    setDeletingId(id);
    setError(null);

    try {
      const supabase = createSupabaseClient();
      const { error: deleteError } = await supabase
        .from("role_briefs")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;

      if (activeBriefId === id) {
        setActiveBrief(null);
      }
      if (editingId === id) {
        resetForm();
      }
      await fetchBriefs();
    } catch (err) {
      setError(getErrorMessage(err, "Failed to delete role brief"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetActive = (brief: RoleBrief) => {
    setActiveBrief(brief);
  };

  return (
    <div className="space-y-10">
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
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
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

      <RoleBriefForm
        values={formValues}
        onChange={setFormValues}
        onSubmit={handleSubmit}
        onCancel={editingId ? resetForm : undefined}
        isSubmitting={isSubmitting}
        editingId={editingId}
      />

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Saved role briefs</h2>
          <p className="mt-1 text-sm text-slate-500">
            Select a brief as active to use it across the app for scoring.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            <span className="text-sm">Loading role briefs…</span>
          </div>
        ) : (
          <RoleBriefList
            briefs={briefs}
            activeBriefId={activeBriefId}
            onSetActive={handleSetActive}
            onEdit={handleEdit}
            onDelete={handleDelete}
            deletingId={deletingId}
          />
        )}
      </section>
    </div>
  );
}
