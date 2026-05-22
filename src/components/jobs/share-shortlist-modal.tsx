"use client";

import { useState } from "react";
import { Copy, Loader2, X } from "lucide-react";
import { karta } from "@/lib/brand/karta";

type ShareShortlistModalProps = {
  jobId: string;
  initialToken: string | null;
  initialEnabled: boolean;
  onClose: () => void;
  onSharingChange?: () => void;
};

function buildShareUrl(token: string): string {
  const base =
    (typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_SITE_URL
      : null) ?? window.location.origin;
  const origin = base.replace(/\/$/, "");
  return `${origin}/share/${token}`;
}

export function ShareShortlistModal({
  jobId,
  initialToken,
  initialEnabled,
  onClose,
  onSharingChange,
}: ShareShortlistModalProps) {
  const [token, setToken] = useState(initialToken);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [disabledMsg, setDisabledMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shareUrl = token && enabled ? buildShareUrl(token) : null;

  const ensureShareLink = async () => {
    setLoading(true);
    setError(null);
    setDisabledMsg(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/share`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create share link");
      setToken(json.token as string);
      setEnabled(true);
      onSharingChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleDisable = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/share`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to disable sharing");
      setEnabled(false);
      setDisabledMsg("Sharing disabled");
      onSharingChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disable");
    } finally {
      setLoading(false);
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
        aria-labelledby="share-shortlist-title"
        className={`relative w-full max-w-md ${karta.card} p-6 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded p-1 text-slate-400 hover:bg-slate-100"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <h2
          id="share-shortlist-title"
          className={`pr-8 ${karta.cardTitle}`}
        >
          Share shortlist
        </h2>
        <p className="mt-2 text-sm text-[#64748B]">
          Anyone with this link can view shortlisted candidates — no login
          required.
        </p>

        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {disabledMsg && (
          <p className="mt-3 text-sm text-[#0D9488]" role="status">
            {disabledMsg}
          </p>
        )}

        {!shareUrl && !loading && !disabledMsg && (
          <button
            type="button"
            onClick={() => void ensureShareLink()}
            className={`mt-4 w-full ${karta.btnPrimary}`}
          >
            {token ? "Enable share link" : "Generate share link"}
          </button>
        )}

        {loading && (
          <div className="mt-6 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[#0D9488]" />
          </div>
        )}

        {shareUrl && !loading && (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-[#334155] break-all">
              {shareUrl}
            </div>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className={`inline-flex w-full items-center justify-center gap-2 ${karta.btnPrimary}`}
            >
              <Copy className="h-4 w-4" />
              {copied ? "Copied!" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={() => void handleDisable()}
              className="w-full text-sm font-medium text-red-600 hover:underline"
            >
              Disable sharing
            </button>
          </div>
        )}

        {!shareUrl && token && !enabled && !loading && (
          <button
            type="button"
            onClick={() => void ensureShareLink()}
            className={`mt-4 w-full ${karta.btnOutlineTeal}`}
          >
            Re-enable sharing
          </button>
        )}
      </div>
    </div>
  );
}

export function useShareShortlist(job: {
  id: string;
  share_token: string | null;
  share_enabled: boolean;
}) {
  const [open, setOpen] = useState(false);

  const handleShare = () => {
    setOpen(true);
  };

  const modal = open ? (
    <ShareShortlistModal
      jobId={job.id}
      initialToken={job.share_token}
      initialEnabled={job.share_enabled}
      onClose={() => setOpen(false)}
    />
  ) : null;

  return { handleShare, shareModal: modal, setShareOpen: setOpen };
}
