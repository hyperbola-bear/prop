import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { GET, POST } from "./route";
import { signSessionToken } from "../../../lib/auth-context";
import { db } from "../../../lib/db";
import { clearRateLimits } from "../../../lib/rate-limit";
import { listings, users } from "../../../../../packages/db/schema";
import type { ListingsResponse } from "../../../../../packages/shared/src/types";

async function tokenFor(email: string): Promise<string> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) throw new Error(`Missing seed user ${email}`);
  return signSessionToken(user.id, []);
}

function jsonRequest(path: string, token: string | null, body: unknown) {
  return new NextRequest(`http://localhost:3100${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
}

describe("GET /api/listings", () => {
  it("returns a paginated list of public HDB rental listings", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3100/api/listings?limit=3")
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.items).toHaveLength(3);
    expect(body.cursor === null || typeof body.cursor === "string").toBe(true);

    for (const item of body.items) {
      expect(item).toMatchObject({
        listing_type: "rental",
        property_type: "hdb"
      });
      expect(typeof item.id).toBe("string");
      expect(typeof item.title).toBe("string");
      expect(typeof item.price_sgd).toBe("number");
      expect(item.address).toEqual(
        expect.objectContaining({
          block: expect.any(String),
          street: expect.any(String),
          postal: expect.any(String),
          town: expect.any(String)
        })
      );
      expect(item.photos.length).toBeGreaterThanOrEqual(1);
      expect(item.photos[0]).toEqual(
        expect.objectContaining({
          url: expect.any(String),
          alt: expect.any(String)
        })
      );
      expect(typeof item.flat_type).toBe("string");
      expect(typeof item.floor_area_sqft).toBe("number");
      expect(typeof item.lease_months).toBe("number");
      expect(typeof item.available_from).toBe("string");
    }
  });

  it("paginates across two pages without gaps or overlap", async () => {
    const firstPageResponse = await GET(
      new NextRequest("http://localhost:3100/api/listings?limit=3")
    );
    expect(firstPageResponse.status).toBe(200);
    const firstPage = (await firstPageResponse.json()) as ListingsResponse;
    expect(firstPage.items).toHaveLength(3);
    expect(typeof firstPage.cursor).toBe("string");
    if (!firstPage.cursor) {
      throw new Error("Expected a cursor for the second page");
    }

    const secondPageResponse = await GET(
      new NextRequest(
        `http://localhost:3100/api/listings?limit=3&cursor=${encodeURIComponent(firstPage.cursor)}`
      )
    );
    expect(secondPageResponse.status).toBe(200);
    const secondPage = (await secondPageResponse.json()) as ListingsResponse;
    expect(secondPage.items).toHaveLength(3);

    const combinedIds = [...firstPage.items, ...secondPage.items].map(
      (item) => item.id
    );
    expect(new Set(combinedIds).size).toBe(combinedIds.length);

    const canonicalResponse = await GET(
      new NextRequest("http://localhost:3100/api/listings?limit=6")
    );
    expect(canonicalResponse.status).toBe(200);
    const canonicalPage = (await canonicalResponse.json()) as ListingsResponse;
    expect(canonicalPage.items.map((item) => item.id)).toEqual(combinedIds);
  });

  it("rejects invalid query parameters with a 400 error", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3100/api/listings?limit=abc")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_request" }
    });
  });

  it("allows the Expo Web origin to read public listings", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3100/api/listings?limit=1")
    );

    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3101"
    );
  });

  it("ANDs town and flat type filters", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost:3100/api/listings?town=TAMPINES&flat_type=4-room&limit=10"
      )
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as ListingsResponse;
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(item.address.town).toBe("TAMPINES");
      expect(item.flat_type).toBe("4-room");
    }
  });

  it("filters by Postgres full-text search", async () => {
    const response = await GET(
      new NextRequest("http://localhost:3100/api/listings?q=balcony&limit=10")
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as ListingsResponse;
    expect(body.items.length).toBeGreaterThan(0);
    expect(
      body.items.every((item) =>
        `${item.title} ${item.description ?? ""}`.toLowerCase().includes("balcony")
      )
    ).toBe(true);
  });

  it("returns only listings inside an MRT radius and includes distance", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost:3100/api/listings?near_mrt=Tampines&radius_km=1&limit=10"
      )
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as ListingsResponse;
    expect(body.items.length).toBeGreaterThan(0);
    for (const item of body.items) {
      expect(item.distance_to_mrt_m).toBeGreaterThanOrEqual(0);
      expect(item.distance_to_mrt_m).toBeLessThanOrEqual(1000);
    }
  });

  it("sorts by price ascending with no pagination gaps or overlap", async () => {
    const firstPageResponse = await GET(
      new NextRequest("http://localhost:3100/api/listings?sort=price_asc&limit=4")
    );
    expect(firstPageResponse.status).toBe(200);
    const firstPage = (await firstPageResponse.json()) as ListingsResponse;
    expect(firstPage.items).toHaveLength(4);
    expect(typeof firstPage.cursor).toBe("string");

    const secondPageResponse = await GET(
      new NextRequest(
        `http://localhost:3100/api/listings?sort=price_asc&limit=4&cursor=${encodeURIComponent(
          firstPage.cursor ?? ""
        )}`
      )
    );
    expect(secondPageResponse.status).toBe(200);
    const secondPage = (await secondPageResponse.json()) as ListingsResponse;
    expect(secondPage.items).toHaveLength(4);

    const combined = [...firstPage.items, ...secondPage.items];
    expect(new Set(combined.map((item) => item.id)).size).toBe(combined.length);
    expect(combined.map((item) => item.price_sgd)).toEqual(
      [...combined.map((item) => item.price_sgd)].sort((a, b) => a - b)
    );

    const canonicalResponse = await GET(
      new NextRequest("http://localhost:3100/api/listings?sort=price_asc&limit=8")
    );
    expect(canonicalResponse.status).toBe(200);
    const canonicalPage = (await canonicalResponse.json()) as ListingsResponse;
    expect(canonicalPage.items.map((item) => item.id)).toEqual(
      combined.map((item) => item.id)
    );
  });
});

describe("POST /api/listings", () => {
  it("creates a draft HDB rental listing for a landlord", async () => {
    clearRateLimits();
    const token = await tokenFor("landlord1@proppy.test");
    const response = await POST(
      jsonRequest("/api/listings", token, {
        title: `Draft listing ${Date.now()}`,
        priceSgd: 250000
      })
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({ id: expect.any(String), status: "draft" });

    const [row] = await db.select().from(listings).where(eq(listings.id, body.id));
    expect(row).toMatchObject({
      status: "draft",
      listingType: "rental",
      propertyType: "hdb"
    });
  });

  it("requires auth and rejects buyer-only users", async () => {
    const unauthenticated = await POST(
      jsonRequest("/api/listings", null, { title: "No auth" })
    );
    expect(unauthenticated.status).toBe(401);

    const buyerToken = await tokenFor("renter1@proppy.test");
    const buyer = await POST(
      jsonRequest("/api/listings", buyerToken, { title: "Buyer draft" })
    );
    expect(buyer.status).toBe(403);
  });

  it("allows an agent to create on behalf of a seller", async () => {
    clearRateLimits();
    const agentToken = await tokenFor("agent1@proppy.test");
    const [seller] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "landlord1@proppy.test"));

    const response = await POST(
      jsonRequest("/api/listings", agentToken, {
        title: `Agent draft ${Date.now()}`,
        ownerUserId: seller!.id,
        mandateVia: "agent_mandate"
      })
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    const [row] = await db.select().from(listings).where(eq(listings.id, body.id));
    expect(row?.ownerUserId).toBe(seller!.id);
    expect(row?.agentUserId).not.toBeNull();
    expect(row?.representedVia).toBe("agent_mandate");
  });
});
