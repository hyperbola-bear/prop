import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { and, count, eq, isNull, ne } from "drizzle-orm";
import { POST as POST_ENQUIRY } from "./route";
import { GET as GET_CONVERSATIONS } from "../conversations/route";
import { GET as GET_CONVERSATION } from "../conversations/[id]/route";
import { POST as POST_MESSAGE } from "../conversations/[id]/messages/route";
import { PATCH as PATCH_READ } from "../conversations/[id]/read/route";
import { GET as GET_UNREAD_COUNT } from "../me/unread-count/route";
import { signSessionToken } from "../../../lib/auth-context";
import { clearRateLimits } from "../../../lib/rate-limit";
import { db } from "../../../lib/db";
import {
  conversations,
  enquiries,
  listings,
  messages,
  users
} from "../../../../../packages/db/schema";

const touchedListingIds: string[] = [];
const touchedConversationIds: string[] = [];

async function userByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error(`Missing seed user ${email}`);
  return user;
}

async function tokenFor(email: string): Promise<string> {
  const user = await userByEmail(email);
  return signSessionToken(user.id, []);
}

async function createListingForSeller(email = "landlord1@proppy.test"): Promise<string> {
  const seller = await userByEmail(email);
  const [listing] = await db
    .insert(listings)
    .values({
      ownerUserId: seller.id,
      status: "published",
      listingType: "rental",
      propertyType: "hdb",
      representedVia: "owner",
      title: `Messaging API ${randomUUID()}`,
      priceSgd: 280000n,
      priceUnit: "month",
      publishedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000)
    })
    .returning({ id: listings.id });
  if (!listing) throw new Error("Failed to create test listing");
  touchedListingIds.push(listing.id);
  return listing.id;
}

function request(path: string, method: string, token: string | null, body?: unknown) {
  return new NextRequest(`http://localhost:3100${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
}

async function countUnreadInConversation(conversationId: string, userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        ne(messages.senderUserId, userId),
        isNull(messages.readAt),
        isNull(messages.deletedAt)
      )
    );
  return row?.value ?? 0;
}

afterEach(async () => {
  clearRateLimits();
  for (const conversationId of touchedConversationIds.splice(0)) {
    await db
      .update(messages)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(messages.conversationId, conversationId));
    await db
      .update(enquiries)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(enquiries.conversationId, conversationId));
    await db
      .update(conversations)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
  }
  for (const listingId of touchedListingIds.splice(0)) {
    await db
      .update(listings)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(listings.id, listingId));
  }
});

describe("messaging API", () => {
  it("creates enquiries, reuses the listing-buyer-seller conversation, and stores scam scoring", async () => {
    const listingId = await createListingForSeller();
    const renterToken = await tokenFor("renter1@proppy.test");

    const firstResponse = await POST_ENQUIRY(
      request("/api/enquiries", "POST", renterToken, {
        listingId,
        body: "WhatsApp me at +6591234567 and pay deposit by Bitcoin"
      })
    );
    expect(firstResponse.status).toBe(201);
    const first = await firstResponse.json();
    touchedConversationIds.push(first.conversationId);
    expect(first).toMatchObject({
      conversationId: expect.any(String),
      messageId: expect.any(String),
      enquiryId: expect.any(String)
    });

    const [scoredMessage] = await db
      .select({
        scamFlags: messages.scamFlags,
        scamScore: messages.scamScore
      })
      .from(messages)
      .where(eq(messages.id, first.messageId));
    expect(scoredMessage?.scamFlags).toEqual(
      expect.arrayContaining(["whatsapp_handoff", "crypto", "offsite_payment"])
    );
    expect(scoredMessage?.scamScore).toBeGreaterThanOrEqual(70);

    const secondResponse = await POST_ENQUIRY(
      request("/api/enquiries", "POST", renterToken, {
        listingId,
        body: "Available?"
      })
    );
    expect(secondResponse.status).toBe(201);
    const second = await secondResponse.json();
    expect(second.conversationId).toBe(first.conversationId);

    const [conversationCount] = await db
      .select({ value: count() })
      .from(conversations)
      .where(and(eq(conversations.listingId, listingId), isNull(conversations.deletedAt)));
    expect(conversationCount?.value).toBe(1);

    const listResponse = await GET_CONVERSATIONS(
      request("/api/conversations", "GET", renterToken)
    );
    expect(listResponse.status).toBe(200);
    const listBody = await listResponse.json();
    expect(listBody.items.some((item: { id: string }) => item.id === first.conversationId)).toBe(
      true
    );

    const detailResponse = await GET_CONVERSATION(
      request(`/api/conversations/${first.conversationId}`, "GET", renterToken),
      { params: Promise.resolve({ id: first.conversationId }) }
    );
    expect(detailResponse.status).toBe(200);
    const detailBody = await detailResponse.json();
    expect(detailBody.messages).toHaveLength(2);
  });

  it("enforces participants, tracks first seller response, unread counts, and read state", async () => {
    const listingId = await createListingForSeller();
    const renterToken = await tokenFor("renter1@proppy.test");
    const landlordToken = await tokenFor("landlord1@proppy.test");
    const otherToken = await tokenFor("renter2@proppy.test");
    const renter = await userByEmail("renter1@proppy.test");

    const enquiryResponse = await POST_ENQUIRY(
      request("/api/enquiries", "POST", renterToken, { listingId, body: "Available?" })
    );
    expect(enquiryResponse.status).toBe(201);
    const enquiry = await enquiryResponse.json();
    touchedConversationIds.push(enquiry.conversationId);

    const forbidden = await GET_CONVERSATION(
      request(`/api/conversations/${enquiry.conversationId}`, "GET", otherToken),
      { params: Promise.resolve({ id: enquiry.conversationId }) }
    );
    expect(forbidden.status).toBe(403);

    const messageResponse = await POST_MESSAGE(
      request(`/api/conversations/${enquiry.conversationId}/messages`, "POST", landlordToken, {
        body: "Yes, still available"
      }),
      { params: Promise.resolve({ id: enquiry.conversationId }) }
    );
    expect(messageResponse.status).toBe(201);

    const [enquiryRow] = await db
      .select({ firstResponseAt: enquiries.firstResponseAt })
      .from(enquiries)
      .where(eq(enquiries.id, enquiry.enquiryId));
    expect(enquiryRow?.firstResponseAt).toBeInstanceOf(Date);
    expect(await countUnreadInConversation(enquiry.conversationId, renter.id)).toBe(1);

    const unreadResponse = await GET_UNREAD_COUNT(request("/api/me/unread-count", "GET", renterToken));
    expect(unreadResponse.status).toBe(200);
    await expect(unreadResponse.json()).resolves.toMatchObject({ count: expect.any(Number) });

    const readResponse = await PATCH_READ(
      request(`/api/conversations/${enquiry.conversationId}/read`, "PATCH", renterToken),
      { params: Promise.resolve({ id: enquiry.conversationId }) }
    );
    expect(readResponse.status).toBe(200);
    await expect(readResponse.json()).resolves.toMatchObject({ updated: 1 });
    expect(await countUnreadInConversation(enquiry.conversationId, renter.id)).toBe(0);
  });

  it("rate limits messages to sixty per minute per conversation", async () => {
    const listingId = await createListingForSeller();
    const renterToken = await tokenFor("renter1@proppy.test");
    const landlordToken = await tokenFor("landlord1@proppy.test");
    const enquiryResponse = await POST_ENQUIRY(
      request("/api/enquiries", "POST", renterToken, { listingId, body: "Available?" })
    );
    const enquiry = await enquiryResponse.json();
    touchedConversationIds.push(enquiry.conversationId);

    let response: Response | null = null;
    for (let index = 0; index < 61; index += 1) {
      response = await POST_MESSAGE(
        request(`/api/conversations/${enquiry.conversationId}/messages`, "POST", landlordToken, {
          body: `Rate limit check ${index}`
        }),
        { params: Promise.resolve({ id: enquiry.conversationId }) }
      );
    }

    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBeTruthy();
  });

  it("rate limits enquiries to sixty message inserts per minute per conversation", async () => {
    const listingId = await createListingForSeller();
    const renterToken = await tokenFor("renter1@proppy.test");

    let response: Response | null = null;
    for (let index = 0; index < 61; index += 1) {
      response = await POST_ENQUIRY(
        request("/api/enquiries", "POST", renterToken, {
          listingId,
          body: `Enquiry rate limit check ${index}`
        })
      );

      if (index === 0) {
        expect(response.status).toBe(201);
        const first = await response.clone().json();
        touchedConversationIds.push(first.conversationId);
      }
    }

    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBeTruthy();
  });
});
