import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, sqlClient } from "../../db";
import { startEmailQueueDrain } from "../email";
import { startSavedSearchAlerts } from "../saved-search-alerts";
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

async function clearMailpit(): Promise<void> {
  const response = await fetch(mailpitUrl, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(`Mailpit clear failed with ${response.status}`);
  }
}

async function findMailpitMessage(subject: string): Promise<MailpitMessage | null> {
  const response = await fetch(mailpitUrl);
  if (!response.ok) {
    throw new Error(`Mailpit list failed with ${response.status}`);
  }

  const body = (await response.json()) as MailpitResponse;
  return body.messages?.find((message) => message.Subject === subject) ?? null;
}

describe("saved-search alerts worker integration", () => {
  const stops: StopTask[] = [];
  const insertedListingIds: string[] = [];
  const insertedSavedSearchIds: string[] = [];
  const insertedAddressIds: string[] = [];

  beforeEach(async () => {
    await clearMailpit();
  });

  afterEach(async () => {
    await Promise.all(stops.splice(0).map((stop) => stop()));

    for (const savedSearchId of insertedSavedSearchIds.splice(0)) {
      await sqlClient`
        UPDATE saved_searches
        SET deleted_at = now(),
            updated_at = now()
        WHERE id = ${savedSearchId}
      `;
    }

    for (const listingId of insertedListingIds.splice(0)) {
      await sqlClient`
        UPDATE listings
        SET deleted_at = now(),
            updated_at = now()
        WHERE id = ${listingId}
      `;
    }

    for (const addressId of insertedAddressIds.splice(0)) {
      await sqlClient`
        UPDATE addresses
        SET deleted_at = now(),
            updated_at = now()
        WHERE id = ${addressId}
      `;
    }
  });

  afterAll(async () => {
    await closeDb();
  });

  it(
    "queues a New match email for a newly published listing matching a saved search and lets the email drain deliver it",
    async () => {
      const suffix = randomUUID();
      const searchName = `Tampines alert ${suffix}`;
      const listingTitle = `Worker saved-search ${suffix}`;
      const subject = `New match: ${searchName}`;

      const [renter] = await sqlClient<{ id: string; email: string }[]>`
        SELECT id, email
        FROM users
        WHERE email = 'renter1@proppy.test'
        LIMIT 1
      `;
      const [owner] = await sqlClient<{ id: string }[]>`
        SELECT id
        FROM users
        WHERE email = 'landlord1@proppy.test'
        LIMIT 1
      `;
      expect(renter).toBeDefined();
      expect(owner).toBeDefined();

      const [address] = await sqlClient<{ id: string }[]>`
        INSERT INTO addresses (
          line_1,
          block,
          street,
          postal_code,
          town,
          country_code
        )
        VALUES (
          '857 Tampines Street 83',
          '857',
          'Tampines Street 83',
          '520857',
          'TAMPINES',
          'SG'
        )
        RETURNING id
      `;
      expect(address).toBeDefined();
      insertedAddressIds.push(address!.id);

      const [listing] = await sqlClient<{ id: string }[]>`
        INSERT INTO listings (
          owner_user_id,
          address_id,
          status,
          listing_type,
          property_type,
          represented_via,
          title,
          description,
          price_sgd,
          price_unit,
          bedrooms,
          published_at,
          expires_at
        )
        VALUES (
          ${owner!.id},
          ${address!.id},
          'published',
          'rental',
          'hdb',
          'owner',
          ${listingTitle},
          'Bright Tampines 4-room flat near amenities.',
          320000,
          'month',
          3,
          now(),
          now() + interval '30 days'
        )
        RETURNING id
      `;
      expect(listing).toBeDefined();
      insertedListingIds.push(listing!.id);

      await sqlClient`
        INSERT INTO listing_rental (
          listing_id,
          lease_months,
          available_from,
          furnishing,
          room_only
        )
        VALUES (
          ${listing!.id},
          12,
          current_date,
          'Fully',
          false
        )
      `;

      await sqlClient`
        INSERT INTO listing_hdb (
          listing_id,
          flat_type,
          floor_level_band,
          floor_area_sqft
        )
        VALUES (
          ${listing!.id},
          '4-room',
          'mid',
          990
        )
      `;

      const [savedSearch] = await sqlClient<{ id: string }[]>`
        INSERT INTO saved_searches (
          user_id,
          name,
          query,
          notify_email,
          last_run_at
        )
        VALUES (
          ${renter!.id},
          ${searchName},
          ${JSON.stringify({ town: "TAMPINES", flat_type: "4-room" })}::jsonb,
          true,
          now() - interval '1 minute'
        )
        RETURNING id
      `;
      expect(savedSearch).toBeDefined();
      insertedSavedSearchIds.push(savedSearch!.id);

      stops.push(startSavedSearchAlerts({ intervalMs: 1_000, drainAfterQueue: false }));

      const queuedEmail = await pollUntil(
        async () => {
          const [row] = await sqlClient<{ subject: string; to_email: string; body: string }[]>`
            SELECT subject, to_email, body
            FROM email_queue
            WHERE subject = ${subject}
            LIMIT 1
          `;
          return row ?? null;
        },
        90_000
      );

      expect(queuedEmail.subject).toBe(subject);
      expect(queuedEmail.to_email).toBe(renter!.email);
      expect(queuedEmail.body).toContain(listingTitle);
      expect(queuedEmail.body).toContain(`/listings/${listing!.id}`);

      const [updatedSearch] = await sqlClient<{ last_run_at: string | null }[]>`
        SELECT last_run_at
        FROM saved_searches
        WHERE id = ${savedSearch!.id}
      `;
      expect(updatedSearch?.last_run_at).toBeTruthy();

      stops.push(startEmailQueueDrain({ intervalMs: 1_000 }));

      const message = await pollUntil(
        async () => findMailpitMessage(subject),
        90_000
      );

      expect(message.Subject).toBe(subject);
      expect(message.To?.[0]?.Address).toBe(renter!.email);
    },
    95_000
  );
});
