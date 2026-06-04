"use client";

import { CandidateIdentityCard } from "@/components/candidates/candidate-identity-card";
import { VerdictBadge } from "@/components/candidates/profile-shared";
import {
  EditableNotesCell,
  EditableSelectCell,
  EditableTextCell,
} from "@/components/shortlist/editable-fields";
import type { ShortlistColumn } from "@/lib/shortlist/default-columns";
import type { PipelineCandidateRow } from "@/types/pipeline";
import type { Job } from "@/types/job";

type PanelOptions = {
  contextJobId: string;
  roleBrief: Job;
};

type ShortlistTableCellProps = {
  row: PipelineCandidateRow;
  col: ShortlistColumn;
  panelOptions: PanelOptions;
  onPatchSystem: (
    id: string,
    field: "relocation" | "present_salary" | "expected_salary" | "recruiter_notes",
    value: string,
  ) => Promise<void>;
  onPatchCustom: (id: string, fieldId: string, value: string) => Promise<void>;
};

export function ShortlistTableCell({
  row,
  col,
  panelOptions,
  onPatchSystem,
  onPatchCustom,
}: ShortlistTableCellProps) {
  if (col.type === "custom") {
    const customFields = row.custom_fields ?? {};
    const value = customFields[col.id] ?? null;
    const fieldType = col.fieldType ?? "text";

    if (fieldType === "select") {
      return (
        <EditableSelectCell
          value={value}
          options={col.options}
          placeholder={col.placeholder}
          onSave={(v) => onPatchCustom(row.id, col.id, v)}
        />
      );
    }

    return (
      <EditableTextCell
        value={value}
        placeholder={col.placeholder}
        inputType={fieldType === "number" ? "number" : fieldType === "date" ? "date" : "text"}
        onSave={(v) => onPatchCustom(row.id, col.id, v)}
      />
    );
  }

  switch (col.id) {
    case "candidate_name":
      return (
        <CandidateIdentityCard
          displayName={row.candidate_name}
          candidateId={row.candidate_id}
          panelOptions={panelOptions}
          compact
          showMetaRow={false}
          education={[]}
          careerGaps={[]}
          topSkills={[]}
        />
      );
    case "email":
      return (
        <span className="text-slate-600">{row.email?.trim() || "—"}</span>
      );
    case "phone":
      return (
        <span className="text-slate-600">{row.phone?.trim() || "—"}</span>
      );
    case "location":
      return (
        <span className="text-slate-600">{row.location?.trim() || "—"}</span>
      );
    case "match":
      return (
        <VerdictBadge
          verdict={row.fit_verdict}
          score={row.fit_score}
          showScore
        />
      );
    case "relocation":
      return (
        <EditableSelectCell
          value={row.relocation}
          options={col.options}
          placeholder={col.placeholder}
          onSave={(v) => onPatchSystem(row.id, "relocation", v)}
        />
      );
    case "present_salary":
      return (
        <EditableTextCell
          value={row.present_salary}
          placeholder={col.placeholder}
          onSave={(v) => onPatchSystem(row.id, "present_salary", v)}
        />
      );
    case "expected_salary":
      return (
        <EditableTextCell
          value={row.expected_salary}
          placeholder={col.placeholder}
          onSave={(v) => onPatchSystem(row.id, "expected_salary", v)}
        />
      );
    case "recruiter_notes":
      return (
        <EditableNotesCell
          value={row.recruiter_notes}
          onSave={(v) => onPatchSystem(row.id, "recruiter_notes", v)}
        />
      );
    default:
      return <span className="text-slate-300">—</span>;
  }
}
