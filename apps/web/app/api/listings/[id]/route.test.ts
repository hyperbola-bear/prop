import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { GET as getListing, PATCH as patchListing } from "./route";
import { GET as getListings } from "../route";
import { signSessionToken } from "../../../../lib/auth-context";
import { db } from "../../../../lib/db";
import { listingRental, listings, users } from "../../../../../../packages/db/schema";

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

describe("GET /api/listings/:id", () => {
  it("returns full detail for a public listing", async () => {
    const listResponse = await getListings(
      new NextRequest("http://localhost:3100/api/listings?limit=1")
    );
    const listBody = await listResponse.json();
    const id = listBody.items[0].id;

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
    const [owner] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "landlord1@proppy.test"));
    const [listing] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(eq(listings.ownerUserId, owner!.id))
      .limit(1);

    const response = await patchListing(
      patchRequest(listing!.id, token, {
        priceSgd: 333300,
        leaseMonths: 18
      }),
      { params: Promise.resolve({ id: listing!.id }) }
    );

    expect(response.status).toBe(200);
    const [row] = await db
      .select({ priceSgd: listings.priceSgd })
      .from(listings)
      .where(eq(listings.id, listing!.id));
    expect(row?.priceSgd).toBe(333300n);

    const [rental] = await db
      .select({ leaseMonths: listingRental.leaseMonths })
      .from(listingRental)
      .where(eq(listingRental.listingId, listing!.id));
    expect(rental?.leaseMonths).toBe(18);
  });

  it("returns 403 for a non-owner", async () => {
    const token = await tokenFor("landlord2@proppy.test");
    const [owner] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "landlord1@proppy.test"));
    const [listing] = await db
      .select({ id: listings.id })
      .from(listings)
      .where(eq(listings.ownerUserId, owner!.id))
      .limit(1);

    const response = await patchListing(
      patchRequest(listing!.id, token, { priceSgd: 444400 }),
      { params: Promise.resolve({ id: listing!.id }) }
    );

    expect(response.status).toBe(403);
  });
});
