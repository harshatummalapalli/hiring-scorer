"use client";

import { useEffect, useState } from "react";
import {
  Archive,
  ArrowRightLeft,
  Download,
  Loader2,
  RefreshCw,
} from "lucide-react";
import type { CandidateDetail, ExperienceEntry } from "@/types/candidate";
import {
  resolvePanelDisplayName,
  resolvePanelLinkedInUrl,
} from "@/lib/candidates/extract-resume-fields";
import {
  formatExperienceDateRange,
  formatExperienceDuration,
} from "@/lib/candidates/format-experience";
import { karta } from "@/lib/brand/karta";
import { SkillPill } from "@/components/ui/skill-pill";
import { StickyNote } from "lucide-react";
import { ScoreRolePickerModal } from "@/components/candidates/score-role-picker-modal";

function resolveEmail(candidate: CandidateDetail): string {
  return (
    candidate.application_email?.trim() ||
    candidate.signal_profile.extracted_email?.trim() ||
    ""
  );
}

function resolvePhone(candidate: CandidateDetail): string {
  return (
    candidate.application_phone?.trim() ||
    candidate.signal_profile.extracted_phone?.trim() ||
    ""
  );
}

function resolveGithubUrl(candidate: CandidateDetail): string | null {
  const username = candidate.signal_profile.github?.username;
  return username ? `https://github.com/${username}` : null;
}

type SkillGroup = { category: string; skills: string[] };

function resolveSkillGroups(
  profile: CandidateDetail["signal_profile"],
): SkillGroup[] | null {
  const extended = profile as typeof profile & {
    skill_groups?: SkillGroup[];
  };
  if (extended.skill_groups?.length) {
    return extended.skill_groups.filter((g) => g.skills.length > 0);
  }
  return null;
}

function resolveAllSkills(profile: CandidateDetail["signal_profile"]): string[] {
  const top = profile.top_skills ?? [];
  if (top.length > 0) return top;
  return [
    ...profile.skills_verified.map((s) => s.skill),
    ...profile.skills_listed_only,
  ];
}

type CandidatePanelProfileTabProps = {
  candidate: CandidateDetail;
  noteFilter: "all" | "role";
  onNoteFilterChange: (f: "all" | "role") => void;
  contextJobId: string | null;
  visibleNotes: CandidateDetail["notes"];
  noteText: string;
  onNoteTextChange: (v: string) => void;
  noteBusy: boolean;
  onAddNote: () => void;
  formatDate: (iso: string) => string;
  hasResumeFile: boolean;
  cvDownloadBusy: boolean;
  onDownloadCv: () => void;
  pdfBusy: boolean;
  canDownloadReport: boolean;
  onDownloadReport: () => void;
  showActions: boolean;
  deleteConfirm: boolean;
  deleteBusy: boolean;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onDeleteRequest: () => void;
  onCandidateUpdated: () => void;
  onArchive: () => Promise<void>;
  archiveBusy: boolean;
  onMoveToRole: (roleBriefId: string) => Promise<void>;
  moveRoleBusy: boolean;
  onReEvaluate: () => Promise<void>;
  reEvaluateBusy: boolean;
  canReEvaluate: boolean;
  isArchived: boolean;
};

function WorkHistoryEntry({ exp }: { exp: ExperienceEntry }) {
  const range = formatExperienceDateRange(exp.start_date, exp.end_date);
  const duration = formatExperienceDuration(exp.start_date, exp.end_date);

  return (
    <li className="border-l-2 border-slate-100 pl-3">
      <p className="text-sm font-semibold text-[#1E293B]">{exp.title}</p>
      <p className="text-xs text-[#64748B]">
        {exp.company}
        {range ? ` · ${range}` : ""}
      </p>
      {duration && (
        <p className="text-xs text-[#64748B]">{duration}</p>
      )}
      {(exp.bullets?.length ?? 0) > 0 && (
        <ul className="mt-1.5 space-y-1">
          {exp.bullets.map((b, j) => (
            <li key={j} className="text-xs leading-relaxed text-[#334155]">
              · {b}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function CandidatePanelProfileTab({
  candidate,
  noteFilter,
  onNoteFilterChange,
  contextJobId,
  visibleNotes,
  noteText,
  onNoteTextChange,
  noteBusy,
  onAddNote,
  formatDate,
  hasResumeFile,
  cvDownloadBusy,
  onDownloadCv,
  pdfBusy,
  canDownloadReport,
  onDownloadReport,
  showActions,
  deleteConfirm,
  deleteBusy,
  onDeleteConfirm,
  onDeleteCancel,
  onDeleteRequest,
  onCandidateUpdated,
  onArchive,
  archiveBusy,
  onMoveToRole,
  moveRoleBusy,
  onReEvaluate,
  reEvaluateBusy,
  canReEvaluate,
  isArchived,
}: CandidatePanelProfileTabProps) {
  const profile = candidate.signal_profile;
  const [editingContact, setEditingContact] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [moveRoleOpen, setMoveRoleOpen] = useState(false);
  const [contactForm, setContactForm] = useState({
    display_name: candidate.display_name,
    email: resolveEmail(candidate),
    phone: resolvePhone(candidate),
    linkedin_url:
      candidate.linkedin_url?.trim() ||
      profile.linkedin_url?.trim() ||
      "",
    github_url: resolveGithubUrl(candidate) ?? "",
    location: profile.location ?? "",
    current_title: profile.current_title ?? "",
    current_company: profile.current_company ?? "",
  });

  useEffect(() => {
    setContactForm({
      display_name: candidate.display_name,
      email: resolveEmail(candidate),
      phone: resolvePhone(candidate),
      linkedin_url:
        candidate.linkedin_url?.trim() ||
        profile.linkedin_url?.trim() ||
        "",
      github_url: resolveGithubUrl(candidate) ?? "",
      location: profile.location ?? "",
      current_title: profile.current_title ?? "",
      current_company: profile.current_company ?? "",
    });
  }, [candidate, profile]);

  const email = resolveEmail(candidate);
  const phone = resolvePhone(candidate);
  const linkedin =
    candidate.linkedin_url?.trim() ||
    profile.linkedin_url?.trim() ||
    resolvePanelLinkedInUrl(candidate.linkedin_url, profile.linkedin_url);
  const github = resolveGithubUrl(candidate);
  const skillGroups = resolveSkillGroups(profile);
  const allSkills = resolveAllSkills(profile);
  const displayName = resolvePanelDisplayName(
    candidate.display_name,
    profile.display_name,
  );
  const experience = profile.experience ?? [];
  const education = profile.education ?? [];

  const saveContact = async () => {
    setContactBusy(true);
    setContactError(null);
    try {
      const res = await fetch(`/api/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: contactForm.display_name.trim(),
          application_email: contactForm.email.trim() || null,
          application_phone: contactForm.phone.trim() || null,
          linkedin_url: contactForm.linkedin_url.trim() || null,
          github_url: contactForm.github_url.trim() || null,
          location: contactForm.location.trim() || null,
          current_title: contactForm.current_title.trim() || null,
          current_company: contactForm.current_company.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      window.dispatchEvent(
        new CustomEvent("karta:candidate-updated", {
          detail: {
            id: candidate.id,
            display_name: contactForm.display_name.trim(),
            current_title: contactForm.current_title.trim() || null,
            current_company: contactForm.current_company.trim() || null,
          },
        }),
      );
      setEditingContact(false);
      onCandidateUpdated();
    } catch (err) {
      setContactError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setContactBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className={`${karta.card} p-4`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className={karta.sectionHeading}>Contact</h3>
          {!editingContact && (
            <button
              type="button"
              onClick={() => setEditingContact(true)}
              className="text-sm text-[#0D9488] hover:text-[#0B8276]"
            >
              Edit
            </button>
          )}
        </div>

        {editingContact ? (
          <div className="mt-3 space-y-3">
            {[
              { key: "display_name", label: "Full Name" },
              { key: "email", label: "Email" },
              { key: "phone", label: "Phone" },
              { key: "linkedin_url", label: "LinkedIn" },
              { key: "github_url", label: "GitHub" },
              { key: "location", label: "Location" },
              { key: "current_title", label: "Current Title" },
              { key: "current_company", label: "Current Company" },
            ].map(({ key, label }) => (
              <label key={key} className="block text-sm">
                <span className="text-xs text-[#64748B]">{label}</span>
                <input
                  type="text"
                  value={contactForm[key as keyof typeof contactForm]}
                  onChange={(e) =>
                    setContactForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                  className={`${karta.input} mt-1`}
                />
              </label>
            ))}
            {contactError && (
              <p className="text-sm text-red-600">{contactError}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={contactBusy}
                onClick={() => void saveContact()}
                className={karta.btnPrimary}
              >
                {contactBusy ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                disabled={contactBusy}
                onClick={() => {
                  setEditingContact(false);
                  setContactError(null);
                }}
                className={karta.btnSecondary}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-xs text-[#64748B]">Full Name</dt>
              <dd className="text-[#334155]">{displayName || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-[#64748B]">Email</dt>
              <dd>
                {email ? (
                  <a
                    href={`mailto:${email}`}
                    className="text-[#0D9488] hover:underline"
                  >
                    {email}
                  </a>
                ) : (
                  <span className="text-[#94A3B8]">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#64748B]">Phone</dt>
              <dd>
                {phone ? (
                  <a
                    href={`tel:${phone.replace(/\s/g, "")}`}
                    className="text-[#0D9488] hover:underline"
                  >
                    {phone}
                  </a>
                ) : (
                  <span className="text-[#94A3B8]">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#64748B]">LinkedIn</dt>
              <dd>
                {linkedin ? (
                  <a
                    href={linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#0D9488] hover:underline"
                  >
                    {linkedin}
                  </a>
                ) : (
                  <span className="text-[#94A3B8]">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[#64748B]">GitHub</dt>
              <dd>
                {github ? (
                  <a
                    href={github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#0D9488] hover:underline"
                  >
                    {github}
                  </a>
                ) : (
                  <span className="text-[#94A3B8]">—</span>
                )}
              </dd>
            </div>
            {(profile.location || profile.current_title || profile.current_company) && (
              <>
                {profile.location && (
                  <div>
                    <dt className="text-xs text-[#64748B]">Location</dt>
                    <dd className="text-[#334155]">{profile.location}</dd>
                  </div>
                )}
                {profile.current_title && (
                  <div>
                    <dt className="text-xs text-[#64748B]">Current Title</dt>
                    <dd className="text-[#334155]">{profile.current_title}</dd>
                  </div>
                )}
                {profile.current_company && (
                  <div>
                    <dt className="text-xs text-[#64748B]">Current Company</dt>
                    <dd className="text-[#334155]">{profile.current_company}</dd>
                  </div>
                )}
              </>
            )}
          </dl>
        )}
      </section>

      <section className={`${karta.card} p-4`}>
        <h3 className={karta.sectionHeading}>Work History</h3>
        {experience.length > 0 ? (
          <ol className="mt-3 space-y-4">
            {experience.map((exp, i) => (
              <WorkHistoryEntry key={i} exp={exp} />
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-[#64748B]">
            No work history extracted from resume
          </p>
        )}
      </section>

      <section className={`${karta.card} p-4`}>
        <h3 className={karta.sectionHeading}>Education</h3>
        {education.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {education.map((ed, i) => (
              <li key={i} className="text-sm">
                <p className="font-medium text-[#1E293B]">
                  {[ed.degree, ed.field].filter(Boolean).join(" · ") || "Degree"}
                </p>
                <p className="text-xs text-[#64748B]">
                  {ed.institution}
                  {ed.year ? ` · ${ed.year}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[#64748B]">
            No education data extracted
          </p>
        )}
      </section>

      <section className={`${karta.card} p-4`}>
        <h3 className={karta.sectionHeading}>All Skills</h3>
        {allSkills.length > 0 ? (
          skillGroups ? (
            <div className="mt-3 space-y-3">
              {skillGroups.map((group, i) => (
                <div key={i}>
                  <p className="text-xs font-medium text-[#64748B]">
                    {group.category}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {group.skills.map((s, j) => (
                      <SkillPill key={j} skill={s} className="text-xs" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {allSkills.map((s, i) => (
                <SkillPill key={i} skill={s} className="text-xs" />
              ))}
            </div>
          )
        ) : (
          <p className="mt-3 text-sm text-[#64748B]">No skills extracted</p>
        )}
      </section>

      <section className={`${karta.card} p-4`}>
        <h3 className={karta.sectionHeading}>Notes</h3>
        {contextJobId && (
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => onNoteFilterChange("all")}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                noteFilter === "all"
                  ? "bg-[#0D9488] text-white"
                  : "bg-slate-100 text-[#64748B] hover:bg-slate-200"
              }`}
            >
              All notes
            </button>
            <button
              type="button"
              onClick={() => onNoteFilterChange("role")}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                noteFilter === "role"
                  ? "bg-[#0D9488] text-white"
                  : "bg-slate-100 text-[#64748B] hover:bg-slate-200"
              }`}
            >
              This role
            </button>
          </div>
        )}
        {visibleNotes.length === 0 ? (
          <div className="mb-3 py-4 text-center">
            <StickyNote
              className="mx-auto h-8 w-8 text-[#94A3B8]"
              aria-hidden
            />
            <p className="mt-2 text-sm text-[#94A3B8]">No notes yet</p>
          </div>
        ) : (
          <ul className="mb-3 space-y-2">
            {visibleNotes.map((n) => (
              <li
                key={n.id}
                className="rounded-md bg-[#F8FAFC] px-3 py-2 text-sm text-[#334155]"
              >
                <p>{n.body}</p>
                <p className="mt-1 text-xs text-[#64748B]">
                  {formatDate(n.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <textarea
          value={noteText}
          onChange={(e) => onNoteTextChange(e.target.value)}
          rows={4}
          placeholder="Add a note about this candidate..."
          className={`${karta.input} min-h-[100px] w-full resize-y`}
        />
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled={noteBusy || !noteText.trim()}
            onClick={onAddNote}
            className={karta.btnPrimary}
          >
            {noteBusy ? "Saving…" : "Add note"}
          </button>
        </div>
      </section>

      {candidate.activity.length > 0 && (
        <section className={`${karta.card} p-4`}>
          <h3 className={karta.sectionHeading}>Activity</h3>
          <ul className="mt-3 space-y-2">
            {candidate.activity.map((a) => (
              <li
                key={a.id}
                className="flex items-start justify-between gap-2 text-sm"
              >
                <span className="text-[#334155]">{a.summary}</span>
                <span className="shrink-0 text-xs text-[#64748B]">
                  {formatDate(a.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${karta.card} p-4`}>
        <h3 className={karta.sectionHeading}>Downloads</h3>
        <div className="mt-3 flex flex-wrap gap-3">
          {hasResumeFile && (
            <button
              type="button"
              disabled={cvDownloadBusy}
              onClick={onDownloadCv}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0D9488] hover:text-[#0B8276] disabled:opacity-50"
            >
              {cvDownloadBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Download Original CV
            </button>
          )}
          <button
            type="button"
            disabled={pdfBusy || !canDownloadReport}
            onClick={onDownloadReport}
            className={`inline-flex items-center gap-1.5 ${karta.btnOutlineTeal} px-2.5 py-1.5 text-xs disabled:opacity-50`}
          >
            {pdfBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Download Report
          </button>
        </div>
      </section>

      {showActions && (
        <section className={`${karta.card} p-4`}>
          <h3 className={karta.sectionHeading}>Actions</h3>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              disabled={archiveBusy || isArchived}
              onClick={() => void onArchive()}
              className={`inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-[#475569] hover:bg-slate-50 disabled:opacity-50`}
            >
              {archiveBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
              {isArchived ? "Archived" : "Archive candidate"}
            </button>
            <button
              type="button"
              disabled={moveRoleBusy}
              onClick={() => setMoveRoleOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-[#475569] hover:bg-slate-50 disabled:opacity-50"
            >
              {moveRoleBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRightLeft className="h-4 w-4" />
              )}
              Move to another role
            </button>
            <button
              type="button"
              disabled={reEvaluateBusy || !canReEvaluate}
              onClick={() => void onReEvaluate()}
              title={
                canReEvaluate
                  ? "Re-score against the current role brief"
                  : "Role brief has not changed since the last evaluation"
              }
              className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-[#475569] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {reEvaluateBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Re-evaluate
            </button>
          </div>

          {!deleteConfirm ? (
            <button
              type="button"
              onClick={onDeleteRequest}
              className="mt-4 text-sm text-red-600 hover:text-red-800"
            >
              Delete candidate
            </button>
          ) : (
            <div className="mt-4 space-y-3 rounded-lg border border-red-100 bg-red-50/40 p-3">
              <p className="text-sm text-[#334155]">
                This will permanently delete this candidate and all their
                scores. This cannot be undone.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={onDeleteCancel}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-[#64748B] hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteBusy}
                  onClick={onDeleteConfirm}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteBusy ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {moveRoleOpen && (
        <ScoreRolePickerModal
          candidateName={displayName}
          preselectedJobId={contextJobId}
          title="Move to another role"
          confirmLabel="Move and evaluate"
          onClose={() => setMoveRoleOpen(false)}
          onConfirm={(jobId) => {
            setMoveRoleOpen(false);
            void onMoveToRole(jobId);
          }}
        />
      )}
    </div>
  );
}
