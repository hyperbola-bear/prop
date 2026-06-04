import nodemailer from "nodemailer";
import { readConfig } from "../config";
import { sqlClient } from "../db";
import { startTicker, type StopTask } from "../ticker";

type EmailQueueRow = {
  id: string;
  to_email: string;
  subject: string;
  body: string;
};

type EmailDrainOptions = {
  intervalMs: number;
  runOnStart?: boolean;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function htmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function drainEmailQueue(): Promise<number> {
  const config = readConfig();
  const transport = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: false
  });

  try {
    return await sqlClient.begin(async (tx) => {
      const rows = await tx<EmailQueueRow[]>`
        SELECT id, to_email, subject, body
        FROM email_queue
        WHERE sent_at IS NULL
          AND deleted_at IS NULL
          AND status = 'pending'
          AND scheduled_at <= now()
        ORDER BY scheduled_at ASC, created_at ASC
        LIMIT 50
        FOR UPDATE SKIP LOCKED
      `;

      if (rows.length === 0) {
        console.log("[worker] email: no pending emails");
        return 0;
      }

      let sent = 0;
      for (const row of rows) {
        try {
          await transport.sendMail({
            from: config.smtpFrom,
            to: row.to_email,
            subject: row.subject,
            text: row.body,
            html: `<p>${htmlEscape(row.body).replaceAll("\n", "<br>")}</p>`
          });

          await tx`
            UPDATE email_queue
            SET sent_at = now(),
                status = 'sent',
                updated_at = now()
            WHERE id = ${row.id}
          `;
          sent += 1;
          console.log(`[worker] email: sent ${row.id} to ${row.to_email}`);
        } catch (error) {
          const message = errorMessage(error);
          await tx`
            UPDATE email_queue
            SET attempts = attempts + 1,
                last_error = ${message},
                updated_at = now()
            WHERE id = ${row.id}
          `;
          console.log(`[worker] email: failed ${row.id}: ${message}`);
        }
      }

      return sent;
    });
  } finally {
    transport.close();
  }
}

export function startEmailQueueDrain({
  intervalMs,
  runOnStart = true
}: EmailDrainOptions): StopTask {
  console.log(`[worker] email: starting drain every ${intervalMs}ms`);
  return startTicker({
    name: "email",
    intervalMs,
    runOnStart,
    run: async () => {
      const sent = await drainEmailQueue();
      console.log(`[worker] email: tick complete; sent ${sent}`);
    }
  });
}
