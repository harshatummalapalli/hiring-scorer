"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useToast } from "@/components/ui/toast";

type CopyButtonProps = {
  text: string;
  className?: string;
  label?: string;
  toastMessage?: string;
};

export function CopyButton({
  text,
  className = "",
  label = "Copy",
  toastMessage,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    if (toastMessage) {
      toast(toastMessage);
    }
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-[#0D9488] hover:text-[#0B8276] ${className}`}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-[#059669]" aria-hidden />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" aria-hidden />
          {label}
        </>
      )}
    </button>
  );
}
