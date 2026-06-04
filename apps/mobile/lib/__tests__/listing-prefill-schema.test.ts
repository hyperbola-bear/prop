import { ownedListingDetailSchema } from "@proppy/shared/schemas";
import { describe, expect, it } from "vitest";

const ownedListingDetailPayload = {
  id: "2d15521a-0b97-4188-b391-3e4d26689e15",
  title: "Seeded 4-room HDB near MRT",
  description: "A seeded listing used by the edit prefill flow.",
  status: "published",
  ownerUserId: "1a15521a-0b97-4188-b391-3e4d26689e15",
  agentUserId: null,
  representedVia: "agent_no_mandate",
  priceSgd: 320000,
  publishedAt: "2026-03-21T00:00:00.000Z",
  refreshedAt: "2026-03-22T00:00:00.000Z",
  rentedAt: null,
  delistedAt: null,
  addressId: "3d15521a-0b97-4188-b391-3e4d26689e15",
  block: "123",
  street: "TOA PAYOH LOR 1",
  postal: "310123",
  town: "TOA PAYOH",
  latitude: "1.334",
  longitude: "103.856",
  flatType: "4-room",
  floorLevelBand: "mid",
  floorAreaSqft: 990,
  blockId: "4d15521a-0b97-4188-b391-3e4d26689e15",
  leaseMonths: 24,
  availableFrom: "2026-04-01",
  furnishing: "Fully",
  photoCount: 3,
  photos: [
    {
      id: "5d15521a-0b97-4188-b391-3e4d26689e15",
      objectPath: "listings/seeded/living.jpg",
      thumbnailObjectPath: "listings/seeded/living-thumb.jpg",
      roomTag: "Living",
      sortOrder: 0,
      url: "https://example.com/listings/seeded/living-thumb.jpg"
    }
  ],
  floorPlan: null
};

describe("mobile listing edit prefill schema", () => {
  it("accepts an owned listing detail when derived metadata is present", () => {
    expect(ownedListingDetailSchema.safeParse(ownedListingDetailPayload).success).toBe(
      true
    );
  });

  it("accepts an owned listing detail without derived refreshed/photo counts", () => {
    const { photoCount: _photoCount, refreshedAt: _refreshedAt, ...withoutDerived } =
      ownedListingDetailPayload;

    expect(ownedListingDetailSchema.safeParse(withoutDerived).success).toBe(true);
  });
});
