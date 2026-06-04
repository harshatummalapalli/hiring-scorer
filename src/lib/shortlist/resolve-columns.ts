import {
  DEFAULT_SHORTLIST_COLUMNS,
  type ShortlistColumn,
  type ShortlistColumnsConfig,
  type ShortlistColumnType,
  type ShortlistFieldType,
} from "@/lib/shortlist/default-columns";

function slugifyId(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `custom_${base || "field"}_${Date.now().toString(36)}`;
}

function parseColumn(raw: unknown): ShortlistColumn | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? "").trim();
  const label = String(o.label ?? "").trim();
  const type = o.type as ShortlistColumnType;
  if (!id || !label) return null;
  if (type !== "system" && type !== "custom") return null;

  const fieldType = o.fieldType as ShortlistFieldType | undefined;
  const options = Array.isArray(o.options)
    ? o.options.map((x) => String(x)).filter(Boolean)
    : undefined;

  return {
    id,
    label,
    type,
    fieldType:
      fieldType === "number" ||
      fieldType === "select" ||
      fieldType === "date" ||
      fieldType === "text"
        ? fieldType
        : undefined,
    visible: o.visible !== false,
    locked: o.locked === true,
    options,
    placeholder:
      o.placeholder != null ? String(o.placeholder) : undefined,
  };
}

export function parseShortlistColumnsConfig(
  raw: unknown,
): ShortlistColumnsConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.columns)) return null;
  const columns = o.columns
    .map(parseColumn)
    .filter((c): c is ShortlistColumn => c != null);
  if (columns.length === 0) return null;
  return { columns };
}

/** Merge saved config with defaults so new system columns appear. */
export function resolveShortlistColumns(raw: unknown): ShortlistColumn[] {
  const saved = parseShortlistColumnsConfig(raw);
  if (!saved) return [...DEFAULT_SHORTLIST_COLUMNS];

  const byId = new Map(saved.columns.map((c) => [c.id, c]));
  const merged: ShortlistColumn[] = [];

  for (const def of DEFAULT_SHORTLIST_COLUMNS) {
    const existing = byId.get(def.id);
    merged.push(
      existing
        ? {
            ...def,
            ...existing,
            type: "system",
            locked: def.locked,
          }
        : { ...def },
    );
    byId.delete(def.id);
  }

  for (const col of saved.columns) {
    if (col.type === "custom" && !merged.some((m) => m.id === col.id)) {
      merged.push(col);
    }
  }

  return merged;
}

export function visibleShortlistColumns(
  columns: ShortlistColumn[],
): ShortlistColumn[] {
  return columns.filter((c) => c.visible);
}

export function createCustomColumn(input: {
  label: string;
  fieldType: ShortlistFieldType;
  options?: string[];
  placeholder?: string;
}): ShortlistColumn {
  return {
    id: slugifyId(input.label),
    label: input.label.trim(),
    type: "custom",
    fieldType: input.fieldType,
    visible: true,
    locked: false,
    options: input.options,
    placeholder: input.placeholder,
  };
}

export function columnsToConfig(columns: ShortlistColumn[]): ShortlistColumnsConfig {
  return { columns };
}
