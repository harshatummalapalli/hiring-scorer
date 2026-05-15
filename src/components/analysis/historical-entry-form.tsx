"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";

const PROVIDER_OPTIONS = ["Claude", "GPT-4o", "Gemini Flash"] as const;

type HistoricalEntryFormProps = {
  onSaved: () => void;
};

export function HistoricalEntryForm({ onSaved }: HistoricalEntryFormProps) {
  const [candidate, setCandidate] = useState("");
  const [scenario, setScenario] = useState("");
  const [extractor, setExtractor] = useState<(typeof PROVIDER_OPTIONS)[number]>(
    "Claude",
  );
  const [advocate, setAdvocate] = useState<(typeof PROVIDER_OPTIONS)[number]>(
    "GPT-4o",
  );
  const [scorer, setScorer] = useState<(typeof PROVIDER_OPTIONS)[number]>(
    "Gemini Flash",
  );
  const [overall, setOverall] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const rolesUnique =
    new Set([extractor, advocate, scorer]).size === 3;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!rolesUnique) {
      setError("Extractor, advocate, and scorer must be three different models.");
      return;
    }

    const score = Number(overall);
    if (Number.isNaN(score) || score < 0 || score > 100) {
      setError("Overall score must be between 0 and 100.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/scoring-runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_filename: candidate,
          scenario_label: scenario,
          model_extractor: extractor,
          model_advocate: advocate,
          model_scorer: scorer,
          overall_score: score,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to save run");

      setSuccess(`Saved ${candidate} · ${scenario}`);
      setCandidate("");
      setScenario("");
      setOverall("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save run");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">
        Add historical scoring run
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Enter results from past scenario tests (overall consensus score only).
        Full dimension detail is captured automatically for new live scores.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Candidate name</span>
            <input
              type="text"
              required
              value={candidate}
              onChange={(e) => setCandidate(e.target.value)}
              placeholder="e.g. Uday"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Scenario label</span>
            <input
              type="text"
              required
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              placeholder="e.g. Scenario 1"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <RoleSelect
            label="Signal extractor"
            value={extractor}
            onChange={setExtractor}
          />
          <RoleSelect
            label="Devil's advocate"
            value={advocate}
            onChange={setAdvocate}
          />
          <RoleSelect
            label="Structured scorer"
            value={scorer}
            onChange={setScorer}
          />
        </div>

        <label className="block text-sm sm:max-w-xs">
          <span className="font-medium text-slate-700">Overall consensus score</span>
          <input
            type="number"
            required
            min={0}
            max={100}
            value={overall}
            onChange={(e) => setOverall(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>

        {!rolesUnique && (
          <p className="text-sm text-amber-700">
            Each model can only play one role per scenario.
          </p>
        )}

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="text-sm text-emerald-700" role="status">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || !rolesUnique}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Add run
        </button>
      </form>
    </section>
  );
}

function RoleSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: (typeof PROVIDER_OPTIONS)[number];
  onChange: (v: (typeof PROVIDER_OPTIONS)[number]) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value as (typeof PROVIDER_OPTIONS)[number])
        }
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      >
        {PROVIDER_OPTIONS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </label>
  );
}
