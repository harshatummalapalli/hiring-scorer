"use client";

import { useEffect, useState } from "react";
import { karta } from "@/lib/brand/karta";

export function EditableTextCell({
  value,
  onSave,
  placeholder,
  inputType = "text",
}: {
  value: string | null;
  onSave: (next: string) => Promise<void>;
  placeholder?: string;
  inputType?: "text" | "number" | "date";
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const commit = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <input
        type={inputType}
        autoFocus
        disabled={saving}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit();
          if (e.key === "Escape") {
            setDraft(value ?? "");
            setEditing(false);
          }
        }}
        className={`w-full min-w-[7rem] ${karta.input} py-1 text-sm`}
        placeholder={placeholder}
      />
    );
  }

  const display = value?.trim();
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="w-full min-h-[1.75rem] rounded px-1 py-0.5 text-left text-sm text-slate-700 hover:bg-slate-50"
    >
      {display ? (
        display
      ) : (
        <span className="text-slate-300">—</span>
      )}
    </button>
  );
}

export function EditableSelectCell({
  value,
  onSave,
  options = [],
  placeholder,
}: {
  value: string | null;
  onSave: (next: string) => Promise<void>;
  options?: string[];
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const commit = async (next: string) => {
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const selectOptions = options.length > 0 ? options : ["—"];

  if (editing) {
    return (
      <select
        autoFocus
        disabled={saving}
        value={draft || ""}
        onChange={(e) => {
          const next = e.target.value;
          setDraft(next);
          void commit(next);
        }}
        onBlur={() => setEditing(false)}
        className={`w-full min-w-[8rem] ${karta.input} py-1 text-sm`}
      >
        <option value="">{placeholder ?? "Select…"}</option>
        {selectOptions.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  const display = value?.trim();
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="w-full min-h-[1.75rem] rounded px-1 py-0.5 text-left text-sm text-slate-700 hover:bg-slate-50"
    >
      {display ? (
        display
      ) : (
        <span className="text-slate-300">—</span>
      )}
    </button>
  );
}

export function EditableNotesCell({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (next: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const commit = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1">
        <textarea
          autoFocus
          disabled={saving}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={6}
          className={`w-full min-w-[14rem] resize-y ${karta.input} py-1 text-sm font-mono leading-relaxed`}
          style={{ minHeight: "7rem" }}
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void commit()}
            className={`text-xs font-medium ${karta.btnPrimary} px-3 py-1`}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(value ?? "");
              setEditing(false);
            }}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const preview = draft.trim();
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="w-full min-h-[3.5rem] rounded px-1 py-1 text-left text-sm text-slate-700 hover:bg-slate-50 whitespace-pre-line"
      style={{ minWidth: "14rem" }}
    >
      {preview ? (
        <span className="line-clamp-4">{preview}</span>
      ) : (
        <span className="text-slate-300">—</span>
      )}
    </button>
  );
}
