import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { POST as publishListing } from "./route";
import { signSessionToken } from "../../../../../lib/auth-context";
import { db } from "../../../../../lib/db";
import {
  blocks,
  listingEvents,
  listingHdb,
  listingPhotos,
  listingRental,
  listings,
  users
} from "../../../../../../../packages/db/schema";

async function seededUser(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) throw new Error(`Missing seed user ${email}`);
  return user;
}

async function tokenFor(email: string): Promise<string> {
  const user = await seededUser(email);
  return signSessionToken(user.id, []);
}

function postRequest(id: string, token: string) {
  return new NextRequest(`http://localhost:3100/api/listings/${id}/publish`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` }
  });
}

async function createDraft(ownerEmail = "landlord1@proppy.test") {
  const owner = await seededUser(ownerEmail);
  const [created] = await db
    .insert(listings)
    .values({
      ownerUserId: owner.id,
      status: "draft",
      listingType: "rental",
      propertyType: "hdb",
      representedVia: "owner",
      title: `Publish draft ${Date.now()} ${Math.random()}`,
      priceSgd: 300000n
    })
    .returning({ id: listings.id });
  return created!.id;
}

async function makeComplete(listingId: string) {
  const [block] = await db
    .select({ id: blocks.id, addressId: blocks.addressId })
    .from(blocks)
    .limit(1);
  await db.update(listings).set({ addressId: block!.addressId }).where(eq(listings.id, listingId));
  await db.insert(listingHdb).values({
    listingId,
    flatType: "4-room",
    floorAreaSqft: 990,
    blockId: block!.id
  });
  await db.insert(listingRental).values({
    listingId,
    leaseMonths: 24,
    availableFrom: new Date().toISOString().slice(0, 10),
    furnishing: "Fully"
  });
  await db.insert(listingPhotos).values(
    [0, 1, 2].map((index) => ({
      listingId,
      s3Key: `tests/${listingId}/${index}.jpg`,
      altText: `Photo ${index + 1}`,
      sortOrder: index
    }))
  );
}

describe("POST /api/listings/:id/publish", () => {
  it("returns listing_incomplete with missing fields for an incomplete draft", async () => {
    const listingId = await createDraft();
    const token = await tokenFor("landlord1@proppy.test");

    const response = await publishListing(postRequest(listingId, token), {
      params: Promise.resolve({ id: listingId })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "listing_incomplete",
      missing: expect.arrayContaining(["photos", "address", "flat_type", "lease_months", "available_from"])
    });
  });

  it("publishes a complete listing and inserts a published event", async () => {
    const listingId = await createDraft();
    await makeComplete(listingId);
    const token = await tokenFor("landlord1@proppy.test");

    const response = await publishListing(postRequest(listingId, token), {
      params: Promise.resolve({ id: listingId })
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "published" });

    const [row] = await db
      .select({
        status: listings.status,
        publishedAt: listings.publishedAt,
        expiresAt: listings.expiresAt
      })
      .from(listings)
      .where(eq(listings.id, listingId));
    expect(row?.status).toBe("published");
    expect(row?.publishedAt).toBeInstanceOf(Date);
    expect(row?.expiresAt).toBeInstanceOf(Date);

    const [event] = await db
      .select({ eventType: listingEvents.eventType })
      .from(listingEvents)
      .where(and(eq(listingEvents.listingId, listingId), eq(listingEvents.eventType, "published")))
      .limit(1);
    expect(event?.eventType).toBe("published");
  });

  it("returns 403 when a different landlord publishes the listing", async () => {
    const listingId = await createDraft("landlord1@proppy.test");
    await makeComplete(listingId);
    const token = await tokenFor("landlord2@proppy.test");

    const response = await publishListing(postRequest(listingId, token), {
      params: Promise.resolve({ id: listingId })
    });

    expect(response.status).toBe(403);
  });
});
