import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { closeDb, sqlClient } from "../../db";
import { breachStaleEnquiries, startEnquirySlaTick } from "../enquiry-sla";
import type { StopTask } from "../../ticker";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUntil<T>(
  action: () => Promise<T | null>,
  timeoutMs: number,
  intervalMs = 250
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await action();
    if (result) return result;
    await sleep(intervalMs);
  }
  throw new Error(`Timed out after ${timeoutMs}ms`);
}

describe("enquiry SLA worker integration", () => {
  const stops: StopTask[] = [];
  const insertedListingIds: string[] = [];
  const insertedConversationIds: string[] = [];

  afterEach(async () => {
    await Promise.all(stops.splice(0).map((stop) => stop()));
    for (const conversationId of insertedConversationIds.splice(0)) {
      await sqlClient`
        UPDATE messages SET deleted_at = now(), updated_at = now()
        WHERE conversation_id = ${conversationId}
      `;
      await sqlClient`
        UPDATE enquiries SET deleted_at = now(), updated_at = now()
        WHERE conversation_id = ${conversationId}
      `;
      await sqlClient`
        UPDATE conversations SET deleted_at = now(), updated_at = now()
        WHERE id = ${conversationId}
      `;
    }
    for (const listingId of insertedListingIds.splice(0)) {
      await sqlClient`
        UPDATE listings SET deleted_at = now(), updated_at = now()
        WHERE id = ${listingId}
      `;
    }
  });

  afterAll(async () => {
    await closeDb();
  });

  it("marks stale unanswered enquiries as SLA breached", async () => {
    const [seller] = await sqlClient<{ id: string }[]>`
      SELECT id FROM users WHERE email = 'landlord1@proppy.test' LIMIT 1
    `;
    const [buyer] = await sqlClient<{ id: string }[]>`
      SELECT id FROM users WHERE email = 'renter1@proppy.test' LIMIT 1
    `;
    expect(seller).toBeDefined();
    expect(buyer).toBeDefined();

    const [listing] = await sqlClient<{ id: string }[]>`
      INSERT INTO listings (
        owner_user_id,
        status,
        listing_type,
        property_type,
        represented_via,
        title,
        price_sgd,
        price_unit
      )
      VALUES (
        ${seller!.id},
        'published',
        'rental',
        'hdb',
        'owner',
        ${`SLA worker ${randomUUID()}`},
        280000,
        'month'
      )
      RETURNING id
    `;
    expect(listing).toBeDefined();
    insertedListingIds.push(listing!.id);

    const [conversation] = await sqlClient<{ id: string }[]>`
      INSERT INTO conversations (listing_id, buyer_user_id, seller_user_id, created_at, updated_at)
      VALUES (${listing!.id}, ${buyer!.id}, ${seller!.id}, now() - interval '25 hours', now())
      RETURNING id
    `;
    expect(conversation).toBeDefined();
    insertedConversationIds.push(conversation!.id);

    const [enquiry] = await sqlClient<{ id: string }[]>`
      INSERT INTO enquiries (
        listing_id,
        buyer_user_id,
        conversation_id,
        created_at,
        updated_at,
        first_response_at,
        sla_breached_at
      )
      VALUES (
        ${listing!.id},
        ${buyer!.id},
        ${conversation!.id},
        now() - interval '25 hours',
        now(),
        NULL,
        NULL
      )
      RETURNING id
    `;
    expect(enquiry).toBeDefined();

    expect(await breachStaleEnquiries()).toBe(1);

    const [row] = await sqlClient<{ sla_breached_at: Date | string | null }[]>`
      SELECT sla_breached_at
      FROM enquiries
      WHERE id = ${enquiry!.id}
    `;
    expect(row?.sla_breached_at).toBeTruthy();
  });

  it("runs the SLA breach check on the worker ticker", async () => {
    const [seller] = await sqlClient<{ id: string }[]>`
      SELECT id FROM users WHERE email = 'landlord1@proppy.test' LIMIT 1
    `;
    const [buyer] = await sqlClient<{ id: string }[]>`
      SELECT id FROM users WHERE email = 'renter1@proppy.test' LIMIT 1
    `;
    const [listing] = await sqlClient<{ id: string }[]>`
      INSERT INTO listings (
        owner_user_id, status, listing_type, property_type, represented_via, title, price_sgd, price_unit
      )
      VALUES (${seller!.id}, 'published', 'rental', 'hdb', 'owner', ${`SLA tick ${randomUUID()}`}, 280000, 'month')
      RETURNING id
    `;
    insertedListingIds.push(listing!.id);
    const [conversation] = await sqlClient<{ id: string }[]>`
      INSERT INTO conversations (listing_id, buyer_user_id, seller_user_id)
      VALUES (${listing!.id}, ${buyer!.id}, ${seller!.id})
      RETURNING id
    `;
    insertedConversationIds.push(conversation!.id);
    const [enquiry] = await sqlClient<{ id: string }[]>`
      INSERT INTO enquiries (listing_id, buyer_user_id, conversation_id, created_at, updated_at)
      VALUES (${listing!.id}, ${buyer!.id}, ${conversation!.id}, now() - interval '25 hours', now())
      RETURNING id
    `;

    stops.push(startEnquirySlaTick({ intervalMs: 1_000 }));

    const row = await pollUntil(async () => {
      const [current] = await sqlClient<{ sla_breached_at: Date | string | null }[]>`
        SELECT sla_breached_at
        FROM enquiries
        WHERE id = ${enquiry!.id}
      `;
      return current?.sla_breached_at ? current : null;
    }, 10_000);

    expect(row.sla_breached_at).toBeTruthy();
  });
});
