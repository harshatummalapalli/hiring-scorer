"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { karta } from "@/lib/brand/karta";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useToast } from "@/components/ui/toast";
import {
  getWorkspaceProfile,
  upsertWorkspaceSettings,
} from "@/lib/workspace/settings";

export default function SettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    void (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        setEmail(user.email ?? null);
        const profile = await getWorkspaceProfile(supabase, user.id);
        setFirstName(profile.first_name);
        setCompanyName(profile.company_name);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      await upsertWorkspaceSettings(supabase, user.id, {
        first_name: firstName.trim(),
        company_name: companyName.trim(),
      });
      setMessage("Settings saved.");
      toast("Settings updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className={karta.pageTitle}>Settings</h1>
      <p className="mt-2 text-sm text-[#64748B]">
        Update your profile shown in the navigation menu.
      </p>
      <form
        onSubmit={(e) => void save(e)}
        className={`mt-8 space-y-4 ${karta.card} p-6`}
      >
        <div>
          <label
            htmlFor="fullName"
            className="block text-sm font-medium text-[#334155]"
          >
            Full Name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            placeholder="Your full name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={`mt-1 w-full ${karta.input}`}
          />
        </div>
        <div>
          <label
            htmlFor="companyName"
            className="block text-sm font-medium text-[#334155]"
          >
            Company name
          </label>
          <input
            id="companyName"
            name="companyName"
            type="text"
            placeholder="Your company name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className={`mt-1 w-full ${karta.input}`}
          />
        </div>
        <div>
          <label
            htmlFor="settings-email"
            style={{
              fontSize: "12px",
              color: "var(--color-text-secondary)",
            }}
          >
            Email
          </label>
          <p
            id="settings-email"
            style={{
              fontSize: "14px",
              color: "var(--color-text-primary)",
              margin: "4px 0 0",
            }}
          >
            {email ?? "—"}
          </p>
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="text-sm text-[#0D9488]" role="status">
            {message}
          </p>
        )}
        <button type="submit" disabled={saving} className={karta.btnPrimary}>
          {saving ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          ) : (
            "Save"
          )}
        </button>
      </form>
    </div>
  );
}
