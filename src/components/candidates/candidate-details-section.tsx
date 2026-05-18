"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { CandidateDetail } from "@/types/candidate";
import { karta } from "@/lib/brand/karta";

type CandidateDetailsSectionProps = {
  candidate: CandidateDetail;
  onSaved: () => void;
};

function dash(value: string | null | undefined): string {
  const v = value?.trim();
  return v ? v : "—";
}

export function CandidateDetailsSection({
  candidate,
  onSaved,
}: CandidateDetailsSectionProps) {
  const profile = candidate.signal_profile;
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    display_name: candidate.display_name,
    current_title: profile.current_title ?? "",
    current_company: profile.current_company ?? "",
    experience_years: "",
    location: profile.location ?? "",
    email: candidate.application_email ?? "",
    phone: candidate.application_phone ?? "",
    linkedin_url: candidate.linkedin_url ?? profile.linkedin_url ?? "",
    github_url: "",
    skills: [
      ...profile.skills_verified.map((s) => s.skill),
      ...profile.skills_listed_only,
    ],
  });
  const [skillInput, setSkillInput] = useState("");

  useEffect(() => {
    const yearsMatch = profile.total_years_experience.match(/(\d+)/);
    setForm({
      display_name: candidate.display_name,
      current_title: profile.current_title ?? "",
      current_company: profile.current_company ?? "",
      experience_years: yearsMatch?.[1] ?? "",
      location: profile.location ?? "",
      email: candidate.application_email ?? "",
      phone: candidate.application_phone ?? "",
      linkedin_url: candidate.linkedin_url ?? profile.linkedin_url ?? "",
      github_url: profile.github?.username
        ? `https://github.com/${profile.github.username}`
        : "",
      skills: [
        ...profile.skills_verified.map((s) => s.skill),
        ...profile.skills_listed_only,
      ],
    });
  }, [candidate, profile]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: form.display_name.trim(),
          current_title: form.current_title.trim() || null,
          current_company: form.current_company.trim() || null,
          experience_years: form.experience_years
            ? Number(form.experience_years)
            : null,
          location: form.location.trim() || null,
          application_email: form.email.trim() || null,
          application_phone: form.phone.trim() || null,
          linkedin_url: form.linkedin_url.trim() || null,
          github_url: form.github_url.trim() || null,
          skills: form.skills,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const addSkill = () => {
    const s = skillInput.trim();
    if (!s) return;
    if (!form.skills.some((x) => x.toLowerCase() === s.toLowerCase())) {
      setForm((f) => ({ ...f, skills: [...f.skills, s] }));
    }
    setSkillInput("");
  };

  if (!editing) {
    return (
      <section className={`${karta.card} p-4`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className={karta.sectionHeading}>Candidate Details</h3>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-sm font-medium text-[#0D9488] hover:text-[#0B8276]"
          >
            Edit
          </button>
        </div>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-[#64748B]">Full Name</dt>
            <dd className="text-[#1E293B]">{dash(candidate.display_name)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#64748B]">Current Title</dt>
            <dd className="text-[#1E293B]">{dash(profile.current_title)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#64748B]">Current Company</dt>
            <dd className="text-[#1E293B]">{dash(profile.current_company)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#64748B]">Experience</dt>
            <dd className="text-[#1E293B]">
              {dash(profile.total_years_experience)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#64748B]">Location</dt>
            <dd className="text-[#1E293B]">{dash(profile.location)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#64748B]">Email</dt>
            <dd className="text-[#1E293B]">{dash(candidate.application_email)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#64748B]">Phone</dt>
            <dd className="text-[#1E293B]">{dash(candidate.application_phone)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#64748B]">LinkedIn</dt>
            <dd className="text-[#1E293B]">
              {candidate.linkedin_url || profile.linkedin_url || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#64748B]">GitHub</dt>
            <dd className="text-[#1E293B]">
              {profile.github?.username
                ? `github.com/${profile.github.username}`
                : "—"}
            </dd>
          </div>
        </dl>
        <div className="mt-3">
          <dt className="text-xs text-[#64748B]">Key Skills</dt>
          <dd className="mt-1 flex flex-wrap gap-1">
            {form.skills.length === 0 ? (
              <span className="text-sm text-[#94A3B8]">—</span>
            ) : (
              form.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-[#334155]"
                >
                  {s}
                </span>
              ))
            )}
          </dd>
        </div>
      </section>
    );
  }

  const field = (
    label: string,
    id: string,
    value: string,
    onChange: (v: string) => void,
    type = "text",
    icon?: ReactNode,
  ) => (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-[#64748B]">
        {label}
      </label>
      <div className="relative mt-1">
        {icon && (
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">
            {icon}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${karta.input} w-full ${icon ? "pl-8" : ""}`}
        />
      </div>
    </div>
  );

  return (
    <section className={`${karta.card} p-4`}>
      <h3 className={karta.sectionHeading}>Candidate Details</h3>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {field("Full Name", "cd-name", form.display_name, (v) =>
          setForm((f) => ({ ...f, display_name: v })),
        )}
        {field("Current Title", "cd-title", form.current_title, (v) =>
          setForm((f) => ({ ...f, current_title: v })),
        )}
        {field("Current Company", "cd-company", form.current_company, (v) =>
          setForm((f) => ({ ...f, current_company: v })),
        )}
        {field(
          "Experience (years)",
          "cd-exp",
          form.experience_years,
          (v) => setForm((f) => ({ ...f, experience_years: v })),
          "number",
        )}
        {field("Location", "cd-loc", form.location, (v) =>
          setForm((f) => ({ ...f, location: v })),
        )}
        {field("Email", "cd-email", form.email, (v) =>
          setForm((f) => ({ ...f, email: v })),
          "email",
        )}
        {field("Phone", "cd-phone", form.phone, (v) =>
          setForm((f) => ({ ...f, phone: v })),
        )}
        {field(
          "LinkedIn URL",
          "cd-li",
          form.linkedin_url,
          (v) => setForm((f) => ({ ...f, linkedin_url: v })),
          "url",
          <span className="text-xs font-bold text-[#0A66C2]">in</span>,
        )}
        {field(
          "GitHub URL",
          "cd-gh",
          form.github_url,
          (v) => setForm((f) => ({ ...f, github_url: v })),
          "url",
          <span className="text-xs font-bold text-[#24292f]">GH</span>,
        )}
      </div>
      <div className="mt-3">
        <label className="text-xs font-medium text-[#64748B]">Key Skills</label>
        <div className="mt-1 flex flex-wrap gap-1">
          {form.skills.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs"
            >
              {s}
              <button
                type="button"
                className="text-slate-500 hover:text-slate-800"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    skills: f.skills.filter((x) => x !== s),
                  }))
                }
                aria-label={`Remove ${s}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          value={skillInput}
          onChange={(e) => setSkillInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addSkill();
            }
          }}
          placeholder="Add skill and press Enter"
          className={`mt-2 ${karta.input} w-full`}
        />
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className={karta.btnPrimary}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setEditing(false)}
          className={karta.btnSecondary}
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
