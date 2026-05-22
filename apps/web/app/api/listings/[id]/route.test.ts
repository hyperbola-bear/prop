import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as getListing } from "./route";
import { GET as getListings } from "../route";

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
