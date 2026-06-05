import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { closeDb, sqlClient } from "../../db";
import { startEmailQueueDrain } from "../email";
import { startExpiryTick } from "../expiry";
import type { StopTask } from "../../ticker";

type MailpitMessage = {
  Subject?: string;
  To?: Array<{ Address?: string }>;
};

type MailpitResponse = {
  messages?: MailpitMessage[];
};

const mailpitUrl = "http://localhost:8025/api/v1/messages";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUntil<T>(
  action: () => Promise<T | null>,
  timeoutMs: number,
  intervalMs = 500
): Promise<T> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await action();
    if (result) return result;
    await sleep(intervalMs);
  }

  throw new Error(`Timed out after ${timeoutMs}ms`);
}

async function findMailpitMessage(subject: string): Promise<MailpitMessage | null> {
  const response = await fetch(mailpitUrl);
  if (!response.ok) {
    throw new Error(`Mailpit list failed with ${response.status}`);
  }

  const body = (await response.json()) as MailpitResponse;
  return body.messages?.find((message) => message.Subject === subject) ?? null;
}

describe("listing expiry worker integration", () => {
  const stops: StopTask[] = [];
  const insertedListingIds: string[] = [];

  afterEach(async () => {
    await Promise.all(stops.splice(0).map((stop) => stop()));

    for (const listingId of insertedListingIds.splice(0)) {
      await sqlClient`
        UPDATE listings
        SET deleted_at = now(),
            updated_at = now()
        WHERE id = ${listingId}
      `;
    }
  });

  afterAll(async () => {
    await closeDb();
  });

  it(
    "expires a past-due published listing, records an event, and delivers a Mailpit email within ninety seconds",
    async () => {
      const title = `Worker expiry ${randomUUID()}`;
      const subject = `Your listing has expired - ${title}`;
      const [owner] = await sqlClient<{ id: string; email: string }[]>`
        SELECT id, email
        FROM users
        WHERE email = 'landlord1@proppy.test'
        LIMIT 1
      `;
      expect(owner).toBeDefined();

      const [listing] = await sqlClient<{ id: string }[]>`
        INSERT INTO listings (
          owner_user_id,
          status,
          listing_type,
          property_type,
          represented_via,
          title,
          price_sgd,
          price_unit,
          published_at,
          expires_at
        )
        VALUES (
          ${owner!.id},
          'published',
          'rental',
          'hdb',
          'owner',
          ${title},
          280000,
          'month',
          now() - interval '31 days',
          now() - interval '1 minute'
        )
        RETURNING id
      `;
      expect(listing).toBeDefined();
      insertedListingIds.push(listing!.id);

      stops.push(startExpiryTick({ intervalMs: 1_000 }));
      stops.push(startEmailQueueDrain({ intervalMs: 1_000 }));

      await pollUntil(async () => {
        const [row] = await sqlClient<{ status: string }[]>`
          SELECT status
          FROM listings
          WHERE id = ${listing!.id}
        `;
        return row?.status === "expired" ? row : null;
      }, 90_000);

      const [event] = await sqlClient<{ event_type: string }[]>`
        SELECT event_type
        FROM listing_events
        WHERE listing_id = ${listing!.id}
          AND event_type = 'expired'
        ORDER BY created_at DESC
        LIMIT 1
      `;
      expect(event?.event_type).toBe("expired");

      const [queuedEmail] = await sqlClient<{ subject: string; to_email: string }[]>`
        SELECT subject, to_email
        FROM email_queue
        WHERE subject = ${subject}
        LIMIT 1
      `;
      expect(queuedEmail).toEqual({
        subject,
        to_email: owner!.email
      });

      const message = await pollUntil(
        async () => findMailpitMessage(subject),
        90_000
      );

      expect(message.Subject).toBe(subject);
      expect(message.To?.[0]?.Address).toBe(owner!.email);
    },
    95_000
  );
});
