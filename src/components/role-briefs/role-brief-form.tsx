"use client";

import { Loader2 } from "lucide-react";
import type { RoleBriefFormValues } from "@/types/role-brief";
import { WeightSlider } from "./weight-slider";

type RoleBriefFormProps = {
  values: RoleBriefFormValues;
  onChange: (values: RoleBriefFormValues) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel?: () => void;
  isSubmitting: boolean;
  editingId: string | null;
};

const weightFields: {
  key: keyof Pick<
    RoleBriefFormValues,
    | "weight_skills"
    | "weight_trajectory"
    | "weight_domain"
    | "weight_seniority"
    | "weight_tenure"
  >;
  label: string;
}[] = [
  { key: "weight_skills", label: "Skills match" },
  { key: "weight_trajectory", label: "Career trajectory" },
  { key: "weight_domain", label: "Domain expertise" },
  { key: "weight_seniority", label: "Seniority fit" },
  { key: "weight_tenure", label: "Tenure stability" },
];

export function RoleBriefForm({
  values,
  onChange,
  onSubmit,
  onCancel,
  isSubmitting,
  editingId,
}: RoleBriefFormProps) {
  const update = <K extends keyof RoleBriefFormValues>(
    key: K,
    value: RoleBriefFormValues[K],
  ) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">
          {editingId ? "Edit role brief" : "Create role brief"}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Define the role requirements and scoring weights for candidate evaluation.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Title" required>
          <input
            type="text"
            required
            value={values.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="e.g. Senior Product Manager"
            className={inputClass}
          />
        </Field>
        <Field label="Department">
          <input
            type="text"
            value={values.department}
            onChange={(e) => update("department", e.target.value)}
            placeholder="e.g. Product"
            className={inputClass}
          />
        </Field>
        <Field label="Years of experience" className="sm:col-span-1">
          <input
            type="text"
            inputMode="numeric"
            value={values.experience_years}
            onChange={(e) =>
              update("experience_years", e.target.value.replace(/[^\d]/g, ""))
            }
            placeholder="e.g. 5"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-5 grid gap-5">
        <Field label="Responsibilities">
          <textarea
            rows={4}
            value={values.responsibilities}
            onChange={(e) => update("responsibilities", e.target.value)}
            placeholder="Key responsibilities for this role..."
            className={textareaClass}
          />
        </Field>
        <Field label="Required skills">
          <textarea
            rows={3}
            value={values.required_skills}
            onChange={(e) => update("required_skills", e.target.value)}
            placeholder="Must-have skills, comma or line separated..."
            className={textareaClass}
          />
        </Field>
        <Field label="Nice-to-have skills">
          <textarea
            rows={3}
            value={values.nice_to_have_skills}
            onChange={(e) => update("nice_to_have_skills", e.target.value)}
            placeholder="Preferred but optional skills..."
            className={textareaClass}
          />
        </Field>
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Scoring weights
        </h3>
        <p className="mt-1 mb-4 text-sm text-slate-500">
          Adjust importance from 1 (low) to 10 (high) for each dimension.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {weightFields.map(({ key, label }) => (
            <WeightSlider
              key={key}
              id={key}
              label={label}
              value={values[key]}
              onChange={(v) => update(key, v)}
            />
          ))}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {editingId ? "Save changes" : "Create role brief"}
        </button>
        {editingId && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel edit
          </button>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

const textareaClass = `${inputClass} resize-y min-h-[80px]`;
