import { afterEach, describe, expect, it } from "vitest";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { GET, POST } from "./route";
import { signSessionToken } from "../../../lib/auth-context";
import { db, sqlClient } from "../../../lib/db";
import { clearRateLimits } from "../../../lib/rate-limit";
import { addresses, listingPhotos, listings, users } from "../../../../../packages/db/schema";
import type { ListingsResponse } from "../../../../../packages/shared/src/types";

const insertedListingIds: string[] = [];
const insertedAddressIds: string[] = [];

afterEach(async () => {
  if (insertedListingIds.length > 0) {
    await db
      .update(listings)
      .set({ deletedAt: new Date() })
      .where(inArray(listings.id, [...insertedListingIds]));
    insertedListingIds.length = 0;
  }
  if (insertedAddressIds.length > 0) {
    await db
      .update(addresses)
      .set({ deletedAt: new Date() })
      .where(inArray(addresses.id, [...insertedAddressIds]));
    insertedAddressIds.length = 0;
  }
});

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

async function seededOwnerId(): Promise<string> {
  const [owner] = await sqlClient<{ id: string }[]>`
    SELECT id FROM users WHERE email = 'landlord1@proppy.test' LIMIT 1
  `;
  if (!owner) throw new Error("Missing landlord1 seed user");
  return owner.id;
}

async function createAddressAtTampinesDistance(distanceM: number): Promise<{
  distanceM: number;
  id: string;
}> {
  const [address] = await sqlClient<{ id: string; distance_m: number }[]>`
    WITH station AS (
      SELECT geom
      FROM external.onemap_amenities
      WHERE amenity_type = 'MRT'
        AND lower(name) = lower('Tampines')
      LIMIT 1
    ),
    projected AS (
      SELECT ST_Project(geom::geography, ${distanceM}::double precision, radians(90))::geometry AS geom
      FROM station
    ),
    inserted AS (
      INSERT INTO addresses (
        line_1,
        block,
        street,
        postal_code,
        town,
        country_code,
        latitude,
        longitude,
        location
      )
      SELECT
        ${`M3 FIX B ${distanceM}m from Tampines MRT`},
        ${String(distanceM)},
        'M3 Fix Boundary Road',
        ${`52${distanceM}`},
        'TAMPINES',
        'SG',
        ST_Y(geom)::text,
        ST_X(geom)::text,
        ST_SetSRID(ST_MakePoint(ST_X(geom), ST_Y(geom)), 4326)::geography
      FROM projected
      RETURNING id, location
    )
    SELECT inserted.id,
           ST_Distance(inserted.location::geography, station.geom::geography) AS distance_m
    FROM inserted
    CROSS JOIN station
  `;
  if (!address) throw new Error("Failed to create boundary address");
  insertedAddressIds.push(address.id);
  return { id: address.id, distanceM: Number(address.distance_m) };
}

async function createSearchListing(input: {
  addressId: string;
  publishedAt: Date;
  priceSgd?: number;
  refreshedAt?: Date | null;
  title: string;
}): Promise<string> {
  const ownerId = await seededOwnerId();
  const description = `${input.title} description`;
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
      refreshed_at,
      expires_at,
      search_vector
    )
    VALUES (
      ${ownerId},
      ${input.addressId},
      'published',
      'rental',
      'hdb',
      'owner',
      ${input.title},
      ${description},
      ${input.priceSgd ?? 330000},
      'month',
      3,
      ${input.publishedAt.toISOString()},
      ${input.refreshedAt?.toISOString() ?? null},
      ${new Date(input.publishedAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()},
      to_tsvector('english', ${`${input.title} ${description}`})
    )
    RETURNING id
  `;
  if (!listing) throw new Error("Failed to create search listing");
  insertedListingIds.push(listing.id);

  await sqlClient`
    INSERT INTO listing_rental (
      listing_id,
      lease_months,
      available_from,
      furnishing,
      room_only
    )
    VALUES (
      ${listing.id},
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
      ${listing.id},
      '4-room',
      'mid',
      990
    )
  `;

  await db.insert(listingPhotos).values({
    listingId: listing.id,
    s3Key: `tests/${listing.id}/cover.jpg`,
    altText: `${input.title} cover photo`,
    sortOrder: 0
  });

  return listing.id;
}

describe("GET /api/listings", () => {
  it("returns a paginated list of public HDB rental listings", async () => {
    const uniqueTerm = `m5public${randomUUID().replace(/-/g, "")}`;
    const address = await createAddressAtTampinesDistance(500);
    for (let index = 0; index < 3; index += 1) {
      await createSearchListing({
        addressId: address.id,
        title: `${uniqueTerm} listing ${index}`,
        publishedAt: new Date(Date.UTC(2026, 5, 20 - index))
      });
    }

    const response = await GET(
      new NextRequest(`http://localhost:3100/api/listings?q=${uniqueTerm}&limit=3`)
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
    const uniqueTerm = `m5pagination${randomUUID().replace(/-/g, "")}`;
    const address = await createAddressAtTampinesDistance(500);
    for (let index = 0; index < 6; index += 1) {
      await createSearchListing({
        addressId: address.id,
        title: `${uniqueTerm} listing ${index}`,
        publishedAt: new Date(Date.UTC(2026, 5, 10 - index))
      });
    }

    const firstPageResponse = await GET(
      new NextRequest(
        `http://localhost:3100/api/listings?q=${uniqueTerm}&limit=3`
      )
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
        `http://localhost:3100/api/listings?q=${uniqueTerm}&limit=3&cursor=${encodeURIComponent(firstPage.cursor)}`
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
      new NextRequest(
        `http://localhost:3100/api/listings?q=${uniqueTerm}&limit=6`
      )
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
    for (const item of body.items) {
      expect(item.distance_to_mrt_m).toBeGreaterThanOrEqual(0);
      expect(item.distance_to_mrt_m).toBeLessThanOrEqual(1000);
    }
  });

  it("sorts refreshed listings with NULL refreshed_at after non-null values and paginates across the null boundary", async () => {
    const uniqueTerm = `m3fixbrefreshed${randomUUID().replace(/-/g, "")}`;
    const nearAddress = await createAddressAtTampinesDistance(500);
    const publishedAt = new Date("2026-06-01T00:00:00.000Z");
    const refreshedId = await createSearchListing({
      addressId: nearAddress.id,
      title: `${uniqueTerm} refreshed`,
      publishedAt,
      refreshedAt: new Date("2026-06-03T00:00:00.000Z")
    });
    const nullRefreshedId = await createSearchListing({
      addressId: nearAddress.id,
      title: `${uniqueTerm} null refreshed`,
      publishedAt: new Date("2026-06-04T00:00:00.000Z"),
      refreshedAt: null
    });

    const response = await GET(
      new NextRequest(
        `http://localhost:3100/api/listings?sort=refreshed&q=${uniqueTerm}&limit=10`
      )
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as ListingsResponse;
    expect(body.items.map((item) => item.id)).toEqual([
      refreshedId,
      nullRefreshedId
    ]);
    expect(body.items[0]?.refreshed_at).not.toBeNull();
    expect(body.items[1]?.refreshed_at).toBeNull();

    const firstPageResponse = await GET(
      new NextRequest(
        `http://localhost:3100/api/listings?sort=refreshed&q=${uniqueTerm}&limit=1`
      )
    );
    expect(firstPageResponse.status).toBe(200);
    const firstPage = (await firstPageResponse.json()) as ListingsResponse;
    expect(firstPage.items.map((item) => item.id)).toEqual([refreshedId]);
    expect(typeof firstPage.cursor).toBe("string");

    const secondPageResponse = await GET(
      new NextRequest(
        `http://localhost:3100/api/listings?sort=refreshed&q=${uniqueTerm}&limit=1&cursor=${encodeURIComponent(
          firstPage.cursor ?? ""
        )}`
      )
    );
    expect(secondPageResponse.status).toBe(200);
    const secondPage = (await secondPageResponse.json()) as ListingsResponse;
    expect(secondPage.items.map((item) => item.id)).toEqual([nullRefreshedId]);
  });

  it("uses geography metres for MRT radius boundaries", async () => {
    const uniqueTerm = `m3fixbradius${randomUUID().replace(/-/g, "")}`;
    const nearAddress = await createAddressAtTampinesDistance(950);
    const farAddress = await createAddressAtTampinesDistance(1050);
    const nearListingId = await createSearchListing({
      addressId: nearAddress.id,
      title: `${uniqueTerm} near`,
      publishedAt: new Date("2026-06-01T00:00:00.000Z")
    });
    const farListingId = await createSearchListing({
      addressId: farAddress.id,
      title: `${uniqueTerm} far`,
      publishedAt: new Date("2026-06-02T00:00:00.000Z")
    });

    expect(nearAddress.distanceM).toBeGreaterThanOrEqual(940);
    expect(nearAddress.distanceM).toBeLessThanOrEqual(960);
    expect(farAddress.distanceM).toBeGreaterThanOrEqual(1040);
    expect(farAddress.distanceM).toBeLessThanOrEqual(1060);

    const response = await GET(
      new NextRequest(
        `http://localhost:3100/api/listings?near_mrt=Tampines&radius_km=1&q=${uniqueTerm}&limit=10`
      )
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as ListingsResponse;
    expect(body.items.map((item) => item.id)).toEqual([nearListingId]);
    expect(body.items[0]?.distance_to_mrt_m).toBeGreaterThanOrEqual(940);
    expect(body.items[0]?.distance_to_mrt_m).toBeLessThanOrEqual(1000);

    const widerResponse = await GET(
      new NextRequest(
        `http://localhost:3100/api/listings?near_mrt=Tampines&radius_km=2&q=${uniqueTerm}&limit=10`
      )
    );
    expect(widerResponse.status).toBe(200);
    const widerBody = (await widerResponse.json()) as ListingsResponse;
    const farItem = widerBody.items.find((item) => item.id === farListingId);
    expect(farItem?.distance_to_mrt_m).toBeGreaterThanOrEqual(1040);
    expect(farItem?.distance_to_mrt_m).toBeLessThanOrEqual(1060);
  });

  it("sorts by price ascending with no pagination gaps or overlap", async () => {
    const uniqueTerm = `m5priceasc${randomUUID().replace(/-/g, "")}`;
    const address = await createAddressAtTampinesDistance(500);
    for (const [index, priceSgd] of [410000, 190000, 350000, 230000, 520000, 275000, 310000, 450000].entries()) {
      await createSearchListing({
        addressId: address.id,
        priceSgd,
        title: `${uniqueTerm} price ${index}`,
        publishedAt: new Date(Date.UTC(2026, 5, 1 + index))
      });
    }

    const firstPageResponse = await GET(
      new NextRequest(
        `http://localhost:3100/api/listings?q=${uniqueTerm}&sort=price_asc&limit=4`
      )
    );
    expect(firstPageResponse.status).toBe(200);
    const firstPage = (await firstPageResponse.json()) as ListingsResponse;
    expect(firstPage.items).toHaveLength(4);
    expect(typeof firstPage.cursor).toBe("string");

    const secondPageResponse = await GET(
      new NextRequest(
        `http://localhost:3100/api/listings?q=${uniqueTerm}&sort=price_asc&limit=4&cursor=${encodeURIComponent(
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
      new NextRequest(
        `http://localhost:3100/api/listings?q=${uniqueTerm}&sort=price_asc&limit=8`
      )
    );
    expect(canonicalResponse.status).toBe(200);
    const canonicalPage = (await canonicalResponse.json()) as ListingsResponse;
    expect(canonicalPage.items.map((item) => item.id)).toEqual(
      combined.map((item) => item.id)
    );
  });

  it("rejects malformed price-sort cursors with invalid_cursor", async () => {
    const malformedCursor = Buffer.from(
      JSON.stringify({
        sort: "price_asc",
        id: "00000000-0000-4000-8000-000000000000",
        priceSgd: "not-a-bigint"
      }),
      "utf8"
    ).toString("base64url");

    const response = await GET(
      new NextRequest(
        `http://localhost:3100/api/listings?sort=price_asc&cursor=${encodeURIComponent(
          malformedCursor
        )}`
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_cursor" }
    });
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
    insertedListingIds.push(body.id);
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
    insertedListingIds.push(body.id);
    const [row] = await db.select().from(listings).where(eq(listings.id, body.id));
    expect(row?.ownerUserId).toBe(seller!.id);
    expect(row?.agentUserId).not.toBeNull();
    expect(row?.representedVia).toBe("agent_mandate");
  });
});
