import Imap from "imap";
import { simpleParser } from "mailparser";

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

const RESUME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

function isResumeAttachment(
  contentType: string,
  filename: string,
): boolean {
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
      tlsOptions: { rejectUnauthorized: false },
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
                      ),
                    )
                    .map((a) => ({
                      filename: a.filename ?? "resume",
                      contentType: a.contentType,
                      content: a.content as Buffer,
                    }));

                  if (attachments.length > 0) {
                    emails.push({
                      messageId: msgId,
                      subject: parsed.subject ?? "",
                      from: parsed.from?.text ?? "",
                      to: typeof parsed.to === "string"
                        ? parsed.to
                        : Array.isArray(parsed.to)
                          ? parsed.to.map((t) => t.text).join(", ")
                          : parsed.to?.text ?? "",
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
