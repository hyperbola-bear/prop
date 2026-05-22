import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";
import type { ListingsResponse } from "../../../../../packages/shared/src/types";

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
});
