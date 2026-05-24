import Imap from "imap";
import { simpleParser } from "mailparser";
import type { ConnectionOptions } from "tls";

/** Gmail IMAP TLS. Default skips cert verify (Windows AV/proxy often breaks chain). Set GMAIL_IMAP_STRICT_TLS=true to enforce. */
function gmailImapTlsOptions(): ConnectionOptions {
  return {
    host: "imap.gmail.com",
    servername: "imap.gmail.com",
    minVersion: "TLSv1.2",
    rejectUnauthorized: process.env.GMAIL_IMAP_STRICT_TLS === "true",
  };
}

export type InboundEmail = {
  messageId: string;
  subject: string;
  from: string;
  to: string;
  receivedAt: Date;
  attachments: Array<{
    filename: string;
    contentType: string;
    content: Buffer;
  }>;
};

const RESUME_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const RESUME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

function isResumeAttachment(
  contentType: string,
  filename: string,
  size?: number,
): boolean {
  if (size !== undefined && size > RESUME_MAX_BYTES) return false;
  if (RESUME_TYPES.includes(contentType)) return true;
  return /\.(pdf|doc|docx|txt)$/i.test(filename);
}

export async function fetchUnprocessedEmails(
  processedIds: Set<string>,
): Promise<InboundEmail[]> {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: process.env.GMAIL_INBOUND_USER!,
      password: process.env.GMAIL_INBOUND_APP_PASSWORD!,
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      tlsOptions: gmailImapTlsOptions(),
    });

    const emails: InboundEmail[] = [];
    let fetchEnded = false;

    imap.once("ready", () => {
      imap.openBox("INBOX", false, (err) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        const since = new Date();
        since.setDate(since.getDate() - 7);

        imap.search([["SINCE", since]], (searchErr, results) => {
          if (searchErr || !results?.length) {
            imap.end();
            return resolve([]);
          }

          const fetch = imap.fetch(results, { bodies: "", markSeen: false });
          let pending = 0;

          fetch.on("message", (msg) => {
            pending += 1;
            let buffer = "";
            msg.on("body", (stream) => {
              stream.on("data", (chunk: Buffer) => {
                buffer += chunk.toString("utf8");
              });
            });
            msg.once("end", () => {
              void (async () => {
                try {
                  const parsed = await simpleParser(buffer);
                  const msgId = parsed.messageId ?? "";
                  if (!msgId || processedIds.has(msgId)) return;

                  const attachments = (parsed.attachments ?? [])
                    .filter((a) =>
                      isResumeAttachment(
                        a.contentType,
                        a.filename ?? "",
                        a.size,
                      ),
                    )
                    .map((a) => ({
                      filename: a.filename ?? "resume",
                      contentType: a.contentType,
                      content: a.content as Buffer,
                    }));

                  if (attachments.length > 0) {
                    const headerGet = (name: string): string | undefined => {
                      const raw = parsed.headers.get(name);
                      if (typeof raw === "string") return raw;
                      if (Array.isArray(raw)) return raw.join(", ");
                      return undefined;
                    };

                    const toTexts: string[] = [];
                    const pushAddr = (
                      addr: typeof parsed.to | typeof parsed.cc,
                    ) => {
                      if (!addr) return;
                      if (typeof addr === "string") {
                        toTexts.push(addr);
                        return;
                      }
                      if (Array.isArray(addr)) {
                        for (const a of addr) toTexts.push(a.text);
                        return;
                      }
                      toTexts.push(addr.text);
                    };
                    pushAddr(parsed.to);
                    pushAddr(parsed.cc);
                    for (const name of [
                      "delivered-to",
                      "x-original-to",
                      "envelope-to",
                    ]) {
                      const v = headerGet(name);
                      if (v) toTexts.push(v);
                    }

                    emails.push({
                      messageId: msgId,
                      subject: parsed.subject ?? "",
                      from: parsed.from?.text ?? "",
                      to: toTexts.join(", "),
                      receivedAt: parsed.date ?? new Date(),
                      attachments,
                    });
                  }
                } catch (e) {
                  console.error("[imap] Parse error:", e);
                } finally {
                  pending -= 1;
                  if (fetchEnded && pending <= 0) imap.end();
                }
              })();
            });
          });

          fetch.once("end", () => {
            fetchEnded = true;
            if (pending <= 0) imap.end();
          });
        });
      });
    });

    imap.once("end", () => resolve(emails));
    imap.once("error", reject);
    imap.connect();
  });
}
