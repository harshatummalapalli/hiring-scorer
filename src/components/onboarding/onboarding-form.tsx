"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { karta } from "@/lib/brand/karta";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  navigateAfterAuth,
  safeIntendedPath,
} from "@/lib/auth/post-login-redirect";
import {
  COMPANY_SIZE_OPTIONS,
  type CompanySize,
  type RecruiterType,
} from "@/lib/workspace/workspace-profiles";

type FieldErrors = Partial<
  Record<
    | "full_name"
    | "role_title"
    | "company_name"
    | "company_size"
    | "submit",
    string
  >
>;

export function OnboardingForm() {
  const searchParams = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [recruiterType, setRecruiterType] = useState<RecruiterType>("inhouse");
  const [companyName, setCompanyName] = useState("");
  const [companySize, setCompanySize] = useState<CompanySize | "">("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyLinkedin, setCompanyLinkedin] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!fullName.trim()) next.full_name = "Full name is required.";
    if (!roleTitle.trim()) next.role_title = "Role title is required.";
    if (!companyName.trim()) next.company_name = "Company name is required.";
    if (!companySize) next.company_size = "Company size is required.";
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validate();
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSaving(true);
    setErrors({});
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const now = new Date().toISOString();
      const { error } = await supabase.from("workspace_profiles").upsert(
        {
          user_id: user.id,
          full_name: fullName.trim(),
          role_title: roleTitle.trim(),
          recruiter_type: recruiterType,
          company_name: companyName.trim(),
          company_size: companySize,
          company_website: companyWebsite.trim() || null,
          company_linkedin: companyLinkedin.trim() || null,
          onboarding_completed: true,
          updated_at: now,
        },
        { onConflict: "user_id" },
      );

      if (error) throw new Error(error.message);
      const after = safeIntendedPath(searchParams.get("next")) ?? "/jobs";
      navigateAfterAuth(after);
      return;
    } catch (err) {
      setErrors({
        submit:
          err instanceof Error ? err.message : "Failed to save your profile",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <div className={`w-full max-w-[560px] ${karta.card} p-8 sm:p-10`}>
        <h1 className="text-2xl font-semibold text-[#1E293B]">Welcome to Kharta</h1>
        <p className="mt-2 text-sm text-[#64748B]">
          Tell us about yourself so Kharta can personalise your experience
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-8 space-y-8">
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-[#1E293B]">
              About You
            </legend>

            <label className="block text-sm font-medium text-[#334155]">
              Full name
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={`mt-1 w-full ${karta.input}`}
                autoComplete="name"
              />
              {errors.full_name && (
                <p className="mt-1 text-sm text-red-600">{errors.full_name}</p>
              )}
            </label>

            <label className="block text-sm font-medium text-[#334155]">
              Your role title
              <input
                type="text"
                value={roleTitle}
                onChange={(e) => setRoleTitle(e.target.value)}
                placeholder="e.g. Talent Acquisition Manager"
                className={`mt-1 w-full ${karta.input}`}
              />
              {errors.role_title && (
                <p className="mt-1 text-sm text-red-600">{errors.role_title}</p>
              )}
            </label>

            <div>
              <p className="text-sm font-medium text-[#334155]">
                Are you recruiting for your own company or for clients?
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-1">
                <button
                  type="button"
                  onClick={() => setRecruiterType("inhouse")}
                  className={toggleClass(recruiterType === "inhouse")}
                >
                  My own company
                </button>
                <button
                  type="button"
                  onClick={() => setRecruiterType("agency")}
                  className={toggleClass(recruiterType === "agency")}
                >
                  For clients — I&apos;m from a staffing or recruitment agency
                </button>
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold text-[#1E293B]">
              About Your Company
            </legend>

            <label className="block text-sm font-medium text-[#334155]">
              {recruiterType === "agency" ? "Agency name" : "Company name"}
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className={`mt-1 w-full ${karta.input}`}
              />
              {errors.company_name && (
                <p className="mt-1 text-sm text-red-600">{errors.company_name}</p>
              )}
            </label>

            <label className="block text-sm font-medium text-[#334155]">
              Company size
              <select
                value={companySize}
                onChange={(e) =>
                  setCompanySize(e.target.value as CompanySize | "")
                }
                className={`mt-1 w-full ${karta.input}`}
              >
                <option value="">Select size</option>
                {COMPANY_SIZE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {errors.company_size && (
                <p className="mt-1 text-sm text-red-600">{errors.company_size}</p>
              )}
            </label>

            <label className="block text-sm font-medium text-[#334155]">
              Company website{" "}
              <span className="font-normal text-[#94A3B8]">(optional)</span>
              <input
                type="text"
                value={companyWebsite}
                onChange={(e) => setCompanyWebsite(e.target.value)}
                placeholder="https://"
                className={`mt-1 w-full ${karta.input}`}
              />
            </label>

            <label className="block text-sm font-medium text-[#334155]">
              Company LinkedIn page{" "}
              <span className="font-normal text-[#94A3B8]">(optional)</span>
              <input
                type="text"
                value={companyLinkedin}
                onChange={(e) => setCompanyLinkedin(e.target.value)}
                placeholder="https://linkedin.com/company/..."
                className={`mt-1 w-full ${karta.input}`}
              />
            </label>
          </fieldset>

          {errors.submit && (
            <p className="text-sm text-red-600" role="alert">
              {errors.submit}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className={`w-full ${karta.btnPrimary} py-3`}
          >
            {saving ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Setting up…
              </span>
            ) : (
              "Set up my workspace"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function toggleClass(active: boolean): string {
  return [
    "rounded-lg border px-4 py-3 text-left text-sm transition-colors",
    active
      ? "border-[#0D9488] bg-teal-50 text-[#0F766E] ring-1 ring-[#0D9488]/30"
      : "border-slate-200 bg-white text-[#334155] hover:border-slate-300",
  ].join(" ");
}
