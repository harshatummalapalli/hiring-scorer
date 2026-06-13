type ResumeUploadFileHintProps = {
  className?: string;
};

export function ResumeUploadFileHint({ className = "" }: ResumeUploadFileHintProps) {
  return (
    <p
      className={className}
      style={{
        fontSize: "11px",
        color: "var(--color-text-secondary)",
      }}
    >
      PDF, DOCX, or TXT · Max 10MB
    </p>
  );
}
