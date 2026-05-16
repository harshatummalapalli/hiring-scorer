import { normalizeResumeText } from "./normalize-resume-text";

const MAX_CHARS = 50_000;

export async function parseResumeFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  let text: string;
  if (name.endsWith(".pdf")) {
    text = await parsePdf(file);
  } else if (name.endsWith(".docx")) {
    text = await parseDocx(file);
  } else if (name.endsWith(".txt")) {
    text = await file.text();
  } else {
    throw new Error("Unsupported file type. Upload PDF, DOCX, or TXT.");
  }

  const trimmed = normalizeResumeText(text);
  if (!trimmed) {
    throw new Error("Could not extract text from this file.");
  }

  if (trimmed.length > MAX_CHARS) {
    return trimmed.slice(0, MAX_CHARS);
  }

  return trimmed;
}

async function parsePdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");

  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(pageText);
  }

  return pages.join("\n");
}

async function parseDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({
    arrayBuffer: await file.arrayBuffer(),
  });
  return result.value;
}
