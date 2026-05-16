"use client";

import { useState } from "react";
import { GripVertical, Plus, X } from "lucide-react";
import type {
  CoreSignal,
  RoleBriefAnalysis,
  StringCategoryId,
} from "@/types/role-brief";
import { STRING_CATEGORIES, TITLE_BANDS } from "@/types/role-brief";

type AnalysisCardsProps = {
  analysis: RoleBriefAnalysis;
  onChange: (next: RoleBriefAnalysis) => void;
  extractedTitle: string;
  onTitleChange: (title: string) => void;
};

type DragItem = {
  from: StringCategoryId | "core_signals";
  index: number;
  text: string;
};

export function AnalysisCards({
  analysis,
  onChange,
  extractedTitle,
  onTitleChange,
}: AnalysisCardsProps) {
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [addDraft, setAddDraft] = useState<Record<string, string>>({});

  const patch = (partial: Partial<RoleBriefAnalysis>) => {
    onChange({ ...analysis, ...partial });
  };

  const removeString = (cat: StringCategoryId, index: number) => {
    const list = [...analysis[cat]];
    list.splice(index, 1);
    patch({ [cat]: list });
  };

  const addString = (cat: StringCategoryId) => {
    const text = (addDraft[cat] ?? "").trim();
    if (!text) return;
    if (analysis[cat].includes(text)) return;
    patch({ [cat]: [...analysis[cat], text] });
    setAddDraft((d) => ({ ...d, [cat]: "" }));
  };

  const moveString = (
    from: StringCategoryId,
    to: StringCategoryId,
    index: number,
    text: string,
  ) => {
    if (from === to) return;
    const fromList = analysis[from].filter((_, i) => i !== index);
    const toList = analysis[to].includes(text)
      ? analysis[to]
      : [...analysis[to], text];
    patch({ [from]: fromList, [to]: toList });
  };

  const moveToCoreSignals = (from: StringCategoryId, index: number, text: string) => {
    const fromList = analysis[from].filter((_, i) => i !== index);
    const exists = analysis.core_signals.some(
      (c) => c.skill.toLowerCase() === text.toLowerCase(),
    );
    const core_signals = exists
      ? analysis.core_signals
      : [...analysis.core_signals, { skill: text, equivalents: [] }];
    patch({ [from]: fromList, core_signals });
  };

  const handleDropOnString = (target: StringCategoryId) => {
    if (!dragItem) return;
    if (dragItem.from === target) {
      setDragItem(null);
      return;
    }
    if (dragItem.from === "core_signals") {
      const core = analysis.core_signals.filter((_, i) => i !== dragItem.index);
      const text = dragItem.text;
      const toList = analysis[target].includes(text)
        ? analysis[target]
        : [...analysis[target], text];
      patch({ core_signals: core, [target]: toList });
    } else {
      moveString(dragItem.from, target, dragItem.index, dragItem.text);
    }
    setDragItem(null);
  };

  const handleDropOnCore = () => {
    if (!dragItem) return;
    if (dragItem.from === "core_signals") {
      setDragItem(null);
      return;
    }
    moveToCoreSignals(dragItem.from, dragItem.index, dragItem.text);
    setDragItem(null);
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Extracted role title
        </h3>
        <input
          type="text"
          value={extractedTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-lg font-semibold text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
        <p className="mt-2 text-xs text-slate-500">
          Auto-detected from the job description — edit if needed.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">Seniority band</h3>
        <p className="mt-1 text-xs text-slate-500">
          Target level for this role.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {TITLE_BANDS.map((band) => (
            <button
              key={band}
              type="button"
              onClick={() => patch({ title_band: band })}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                analysis.title_band === band
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {band}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {STRING_CATEGORIES.map((cat) => (
          <StringCategoryCard
            key={cat.id}
            label={cat.label}
            description={cat.description}
            items={analysis[cat.id]}
            addValue={addDraft[cat.id] ?? ""}
            onAddValueChange={(v) =>
              setAddDraft((d) => ({ ...d, [cat.id]: v }))
            }
            onAdd={() => addString(cat.id)}
            onRemove={(i) => removeString(cat.id, i)}
            onDragStart={(index, text) =>
              setDragItem({ from: cat.id, index, text })
            }
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDropOnString(cat.id)}
            isDragging={dragItem != null}
          />
        ))}
      </div>

      <CoreSignalsCard
        signals={analysis.core_signals}
        onChange={(core_signals) => patch({ core_signals })}
        onDragStart={(index, text) =>
          setDragItem({ from: "core_signals", index, text })
        }
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDropOnCore}
      />

      <SemanticClustersCard
        clusters={analysis.semantic_clusters}
        onChange={(semantic_clusters) => patch({ semantic_clusters })}
      />
    </div>
  );
}

function StringCategoryCard({
  label,
  description,
  items,
  addValue,
  onAddValueChange,
  onAdd,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
}: {
  label: string;
  description: string;
  items: string[];
  addValue: string;
  onAddValueChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onDragStart: (index: number, text: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  isDragging: boolean;
}) {
  return (
    <section
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`rounded-2xl border bg-white p-5 shadow-sm transition ${
        isDragging ? "border-slate-400 ring-2 ring-slate-100" : "border-slate-200"
      }`}
    >
      <h3 className="font-semibold text-slate-900">{label}</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{description}</p>
      <div className="mt-4 flex min-h-[3rem] flex-wrap gap-2">
        {items.length === 0 ? (
          <p className="text-xs text-slate-400">Drop items here or add below</p>
        ) : (
          items.map((item, index) => (
            <Tag
              key={`${item}-${index}`}
              text={item}
              draggable
              onDragStart={() => onDragStart(index, item)}
              onRemove={() => onRemove(index)}
            />
          ))
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={addValue}
          onChange={(e) => onAddValueChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAdd())}
          placeholder="Add item…"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
    </section>
  );
}

function CoreSignalsCard({
  signals,
  onChange,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  signals: CoreSignal[];
  onChange: (signals: CoreSignal[]) => void;
  onDragStart: (index: number, text: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}) {
  const [skillDraft, setSkillDraft] = useState("");
  const [eqDraft, setEqDraft] = useState<Record<number, string>>({});

  const addSkill = () => {
    const skill = skillDraft.trim();
    if (!skill) return;
    if (signals.some((s) => s.skill.toLowerCase() === skill.toLowerCase())) return;
    onChange([...signals, { skill, equivalents: [] }]);
    setSkillDraft("");
  };

  const addEquivalent = (index: number) => {
    const text = (eqDraft[index] ?? "").trim();
    if (!text) return;
    const next = signals.map((s, i) => {
      if (i !== index) return s;
      if (s.equivalents.includes(text)) return s;
      return { ...s, equivalents: [...s.equivalents, text] };
    });
    onChange(next);
    setEqDraft((d) => ({ ...d, [index]: "" }));
  };

  return (
    <section
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h3 className="font-semibold text-slate-900">Core signals</h3>
      <p className="mt-1 text-xs text-slate-500">
        Important skills that drive scoring — each with equivalent terms.
      </p>

      <div className="mt-6 space-y-4">
        {signals.map((signal, index) => (
          <div
            key={`${signal.skill}-${index}`}
            className="rounded-xl border border-slate-100 bg-slate-50/80 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div
                draggable
                onDragStart={() => onDragStart(index, signal.skill)}
                className="flex min-w-0 flex-1 cursor-grab items-center gap-2"
              >
                <GripVertical className="h-4 w-4 shrink-0 text-slate-400" />
                <span className="font-medium text-slate-900">{signal.skill}</span>
              </div>
              <button
                type="button"
                onClick={() => onChange(signals.filter((_, i) => i !== index))}
                className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                aria-label="Remove skill"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 pl-6">
              {signal.equivalents.map((eq, ei) => (
                <Tag
                  key={eq}
                  text={eq}
                  onRemove={() =>
                    onChange(
                      signals.map((s, i) =>
                        i === index
                          ? {
                              ...s,
                              equivalents: s.equivalents.filter(
                                (_, j) => j !== ei,
                              ),
                            }
                          : s,
                      ),
                    )
                  }
                />
              ))}
            </div>
            <div className="mt-3 flex gap-2 pl-6">
              <input
                type="text"
                value={eqDraft[index] ?? ""}
                onChange={(e) =>
                  setEqDraft((d) => ({ ...d, [index]: e.target.value }))
                }
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addEquivalent(index))
                }
                placeholder="Add equivalent…"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => addEquivalent(index)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Add
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={skillDraft}
          onChange={(e) => setSkillDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
          placeholder="Add core skill…"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={addSkill}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          <Plus className="h-4 w-4" />
          Add skill
        </button>
      </div>
    </section>
  );
}

function SemanticClustersCard({
  clusters,
  onChange,
}: {
  clusters: Record<string, string[]>;
  onChange: (clusters: Record<string, string[]>) => void;
}) {
  const [skillDraft, setSkillDraft] = useState("");
  const [techDraft, setTechDraft] = useState<Record<string, string>>({});

  const skills = Object.keys(clusters);

  const addCluster = () => {
    const skill = skillDraft.trim();
    if (!skill || clusters[skill]) return;
    onChange({ ...clusters, [skill]: [] });
    setSkillDraft("");
  };

  const addTech = (skill: string) => {
    const tech = (techDraft[skill] ?? "").trim();
    if (!tech) return;
    const list = clusters[skill] ?? [];
    if (list.includes(tech)) return;
    onChange({ ...clusters, [skill]: [...list, tech] });
    setTechDraft((d) => ({ ...d, [skill]: "" }));
  };

  const removeCluster = (skill: string) => {
    const next = { ...clusters };
    delete next[skill];
    onChange(next);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="font-semibold text-slate-900">Semantic clusters</h3>
      <p className="mt-1 text-xs text-slate-500">
        Required skills mapped to technologies that imply proficiency.
      </p>

      <div className="mt-6 space-y-4">
        {skills.map((skill) => (
          <div
            key={skill}
            className="rounded-xl border border-slate-100 bg-slate-50/80 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-900">{skill}</span>
              <button
                type="button"
                onClick={() => removeCluster(skill)}
                className="text-xs text-slate-500 hover:text-red-600"
              >
                Remove cluster
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(clusters[skill] ?? []).map((tech, ti) => (
                <Tag
                  key={tech}
                  text={tech}
                  onRemove={() =>
                    onChange({
                      ...clusters,
                      [skill]: clusters[skill].filter((_, i) => i !== ti),
                    })
                  }
                />
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={techDraft[skill] ?? ""}
                onChange={(e) =>
                  setTechDraft((d) => ({ ...d, [skill]: e.target.value }))
                }
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addTech(skill))
                }
                placeholder="Add technology…"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => addTech(skill)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium"
              >
                Add
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={skillDraft}
          onChange={(e) => setSkillDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCluster())}
          placeholder="New skill cluster name…"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={addCluster}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" />
          Add cluster
        </button>
      </div>
    </section>
  );
}

function Tag({
  text,
  draggable,
  onDragStart,
  onRemove,
}: {
  text: string;
  draggable?: boolean;
  onDragStart?: () => void;
  onRemove: () => void;
}) {
  return (
    <span
      draggable={draggable}
      onDragStart={onDragStart}
      className={`inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200 bg-white py-1 pl-2 pr-1 text-sm text-slate-800 shadow-sm ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      {draggable && <GripVertical className="h-3 w-3 shrink-0 text-slate-400" />}
      <span className="truncate">{text}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-slate-100"
        aria-label={`Remove ${text}`}
      >
        <X className="h-3.5 w-3.5 text-slate-500" />
      </button>
    </span>
  );
}

