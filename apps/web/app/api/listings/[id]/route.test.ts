import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { GET as getListing, PATCH as patchListing } from "./route";
import { GET as getListings } from "../route";
import { signSessionToken } from "../../../../lib/auth-context";
import { db } from "../../../../lib/db";
import { listingRental, listings, users } from "../../../../../../packages/db/schema";

const insertedListingIds: string[] = [];

afterEach(async () => {
  if (insertedListingIds.length > 0) {
    await db
      .update(listings)
      .set({ deletedAt: new Date() })
      .where(inArray(listings.id, [...insertedListingIds]));
    insertedListingIds.length = 0;
  }
});

async function tokenFor(email: string): Promise<string> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) throw new Error(`Missing seed user ${email}`);
  return signSessionToken(user.id, []);
}

function patchRequest(id: string, token: string, body: unknown) {
  return new NextRequest(`http://localhost:3100/api/listings/${id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
}

async function createPatchableListing(ownerEmail = "landlord1@proppy.test") {
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, ownerEmail));
  if (!owner) throw new Error(`Missing seed user ${ownerEmail}`);

  const [listing] = await db
    .insert(listings)
    .values({
      ownerUserId: owner.id,
      status: "published",
      listingType: "rental",
      propertyType: "hdb",
      representedVia: "owner",
      title: `Patch listing ${Date.now()} ${Math.random()}`,
      priceSgd: 300000n
    })
    .returning({ id: listings.id });
  if (!listing) throw new Error("Failed to create patchable listing");
  insertedListingIds.push(listing.id);

  await db.insert(listingRental).values({
    listingId: listing.id,
    leaseMonths: 12,
    availableFrom: new Date().toISOString().slice(0, 10),
    furnishing: "Fully",
    roomOnly: false
  });

  return listing.id;
}

describe("GET /api/listings/:id", () => {
  it("returns full detail for a public listing", async () => {
    const listResponse = await getListings(
      new NextRequest("http://localhost:3100/api/listings?limit=20")
    );
    const listBody = await listResponse.json();
    const publicListing = listBody.items.find((item: { photos?: unknown[] }) => {
      return Array.isArray(item.photos) && item.photos.length >= 3;
    });
    if (!publicListing) {
      throw new Error("Expected at least one public listing with seeded photos");
    }
    const id = publicListing.id;

    const response = await getListing(
      new NextRequest(`http://localhost:3100/api/listings/${id}`),
      { params: Promise.resolve({ id }) }
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toEqual(
      expect.objectContaining({
        id,
        title: expect.any(String),
        price_sgd: expect.any(Number),
        description: expect.any(String),
        listing_type: "rental",
        property_type: "hdb",
        flat_type: expect.any(String),
        floor_area_sqft: expect.any(Number),
        lease_months: expect.any(Number),
        available_from: expect.any(String),
        floor_plan: null,
        agent_or_landlord: expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          type: expect.stringMatching(/^(agent|landlord)$/)
        })
      })
    );
    expect(body.photos.length).toBeGreaterThanOrEqual(3);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3101"
    );
  });

  it("returns 404 for a missing listing", async () => {
    const missingId = "00000000-0000-0000-0000-000000000000";
    const response = await getListing(
      new NextRequest(`http://localhost:3100/api/listings/${missingId}`),
      { params: Promise.resolve({ id: missingId }) }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "not_found" }
    });
  });
});

describe("PATCH /api/listings/:id", () => {
  it("updates listing price and rental fields for the owner", async () => {
    const token = await tokenFor("landlord1@proppy.test");
    const listingId = await createPatchableListing("landlord1@proppy.test");

    const response = await patchListing(
      patchRequest(listingId, token, {
        priceSgd: 333300,
        leaseMonths: 18
      }),
      { params: Promise.resolve({ id: listingId }) }
    );

    expect(response.status).toBe(200);
    const [row] = await db
      .select({ priceSgd: listings.priceSgd })
      .from(listings)
      .where(eq(listings.id, listingId));
    expect(row?.priceSgd).toBe(333300n);

    const [rental] = await db
      .select({ leaseMonths: listingRental.leaseMonths })
      .from(listingRental)
      .where(eq(listingRental.listingId, listingId));
    expect(rental?.leaseMonths).toBe(18);
  });

  it("returns 403 for a non-owner", async () => {
    const token = await tokenFor("landlord2@proppy.test");
    const listingId = await createPatchableListing("landlord1@proppy.test");

    const response = await patchListing(
      patchRequest(listingId, token, { priceSgd: 444400 }),
      { params: Promise.resolve({ id: listingId }) }
    );

    expect(response.status).toBe(403);
  });
});
