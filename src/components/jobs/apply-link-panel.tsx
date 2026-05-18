"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { CopyButton } from "@/components/ui/copy-button";
import { buildFullApplyUrl } from "@/lib/jobs/apply-url";
import { karta } from "@/lib/brand/karta";

type ApplyLinkPanelProps = {
  applyLink: string | null;
  applicationToken: string | null;
};

export function ApplyLinkPanel({
  applyLink,
  applicationToken,
}: ApplyLinkPanelProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const fullUrl = buildFullApplyUrl(applyLink, applicationToken);

  useEffect(() => {
    if (!fullUrl) {
      setQrDataUrl(null);
      return;
    }
    void QRCode.toDataURL(fullUrl, { width: 160, margin: 2 }).then(setQrDataUrl);
  }, [fullUrl]);

  return (
    <section className={`${karta.card} p-6`}>
      <h3 className={karta.sectionHeading}>Apply link</h3>
      <p className="mt-1 text-sm text-[#64748B]">
        Share this link for candidates to apply directly to this job.
      </p>
      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <code className="block flex-1 break-all rounded-md bg-[#F8FAFC] px-3 py-2 text-sm text-[#1E293B]">
              {fullUrl || "No apply link yet — save the job to generate one."}
            </code>
            {fullUrl && <CopyButton text={fullUrl} label="Copy Link" />}
          </div>
        </div>
        {qrDataUrl && (
          <img
            src={qrDataUrl}
            alt="QR code for application link"
            className="h-40 w-40 shrink-0 rounded-lg border border-slate-200 bg-white p-2"
          />
        )}
      </div>
    </section>
  );
}
