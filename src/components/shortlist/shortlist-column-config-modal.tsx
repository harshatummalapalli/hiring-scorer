"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import {
  SHORTLIST_COLUMN_PRESETS,
  type ShortlistColumn,
  type ShortlistFieldType,
} from "@/lib/shortlist/default-columns";
import { createCustomColumn } from "@/lib/shortlist/resolve-columns";
import { karta } from "@/lib/brand/karta";

type ShortlistColumnConfigModalProps = {
  open: boolean;
  initialColumns: ShortlistColumn[];
  onClose: () => void;
  onSaved: (columns: ShortlistColumn[]) => void;
};

const FIELD_TYPES: { value: ShortlistFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown" },
  { value: "date", label: "Date" },
];

export function ShortlistColumnConfigModal({
  open,
  initialColumns,
  onClose,
  onSaved,
}: ShortlistColumnConfigModalProps) {
  const [columns, setColumns] = useState<ShortlistColumn[]>(initialColumns);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<ShortlistFieldType>("text");
  const [newOptions, setNewOptions] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (open) {
      setColumns(initialColumns);
      setError(null);
    }
  }, [open, initialColumns]);

  if (!open) return null;

  const systemColumns = columns.filter((c) => c.type === "system");
  const customColumns = columns.filter((c) => c.type === "custom");

  const updateColumn = (id: string, patch: Partial<ShortlistColumn>) => {
    setColumns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  };

  const removeCustom = (id: string) => {
    if (!window.confirm("Remove this custom column? Existing values will remain in the database but will no longer be shown.")) {
      return;
    }
    setColumns((prev) => prev.filter((c) => c.id !== id));
  };

  const addCustomColumn = (preset?: (typeof SHORTLIST_COLUMN_PRESETS)[number]) => {
    const label = preset?.label ?? newLabel.trim();
    if (!label) return;
    const fieldType = preset?.fieldType ?? newType;
    const options =
      fieldType === "select"
        ? (preset?.options ??
          newOptions
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean))
        : undefined;
    const col = createCustomColumn({
      label,
      fieldType,
      options: options?.length ? options : undefined,
      placeholder: preset?.placeholder,
    });
    setColumns((prev) => [...prev, col]);
    setNewLabel("");
    setNewOptions("");
    setShowAddForm(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortlist_columns: columns }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to save");
      const saved = (json.shortlist_columns as ShortlistColumn[]) ?? columns;
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="shortlist-columns-title"
        className={`flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden ${karta.card} shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="shortlist-columns-title" className={karta.cardTitle}>
              Customize columns
            </h2>
            <p className="mt-1 text-sm text-[#64748B]">
              Show, hide, and rename shortlist fields for your workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 space-y-6">
          <section>
            <h3 className={karta.sectionHeading}>Default columns</h3>
            <ul className="mt-3 space-y-3">
              {systemColumns.map((col) => (
                <li
                  key={col.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2"
                >
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={col.visible}
                      disabled={col.locked}
                      onChange={(e) =>
                        updateColumn(col.id, { visible: e.target.checked })
                      }
                      className="h-4 w-4 rounded border-slate-300 accent-[#0D9488]"
                    />
                    <span className="text-[#64748B]">Visible</span>
                  </label>
                  <input
                    type="text"
                    value={col.label}
                    disabled={col.locked && col.id === "candidate_name"}
                    onChange={(e) =>
                      updateColumn(col.id, { label: e.target.value })
                    }
                    className={`min-w-0 flex-1 ${karta.input} py-1 text-sm`}
                  />
                  {col.locked && (
                    <span className="text-[10px] font-medium uppercase text-[#94A3B8]">
                      Locked
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className={karta.sectionHeading}>Custom columns</h3>
            {customColumns.length === 0 ? (
              <p className="mt-2 text-sm text-[#64748B]">
                No custom columns yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {customColumns.map((col) => (
                  <li
                    key={col.id}
                    className="space-y-2 rounded-lg border border-slate-200 px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={col.visible}
                          onChange={(e) =>
                            updateColumn(col.id, { visible: e.target.checked })
                          }
                          className="h-4 w-4 rounded border-slate-300 accent-[#0D9488]"
                        />
                        Visible
                      </label>
                      <input
                        type="text"
                        value={col.label}
                        onChange={(e) =>
                          updateColumn(col.id, { label: e.target.value })
                        }
                        className={`min-w-0 flex-1 ${karta.input} py-1 text-sm`}
                      />
                      <button
                        type="button"
                        onClick={() => removeCustom(col.id)}
                        className="rounded p-1 text-red-500 hover:bg-red-50"
                        aria-label={`Delete ${col.label}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <select
                      value={col.fieldType ?? "text"}
                      onChange={(e) =>
                        updateColumn(col.id, {
                          fieldType: e.target.value as ShortlistFieldType,
                        })
                      }
                      className={`${karta.input} w-full text-sm`}
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    {col.fieldType === "select" && (
                      <input
                        type="text"
                        value={(col.options ?? []).join(", ")}
                        onChange={(e) =>
                          updateColumn(col.id, {
                            options: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="Options, comma-separated"
                        className={`${karta.input} w-full text-sm`}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {SHORTLIST_COLUMN_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => addCustomColumn(preset)}
                  className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-[#64748B] hover:border-[#0D9488] hover:text-[#0D9488]"
                >
                  + {preset.label}
                </button>
              ))}
            </div>

            {showAddForm ? (
              <div className="mt-4 space-y-2 rounded-lg border border-dashed border-[#0D9488]/40 p-3">
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Column label"
                  className={`${karta.input} w-full text-sm`}
                />
                <select
                  value={newType}
                  onChange={(e) =>
                    setNewType(e.target.value as ShortlistFieldType)
                  }
                  className={`${karta.input} w-full text-sm`}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {newType === "select" && (
                  <input
                    type="text"
                    value={newOptions}
                    onChange={(e) => setNewOptions(e.target.value)}
                    placeholder="Options, comma-separated"
                    className={`${karta.input} w-full text-sm`}
                  />
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => addCustomColumn()}
                    disabled={!newLabel.trim()}
                    className={karta.btnPrimary}
                  >
                    Add column
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className={karta.btnSecondary}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className={`mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[#0D9488] hover:text-[#0B8276]`}
              >
                <Plus className="h-4 w-4" />
                Add custom column
              </button>
            )}
          </section>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={onClose} className={karta.btnSecondary}>
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className={karta.btnPrimary}
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </span>
            ) : (
              "Save configuration"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
