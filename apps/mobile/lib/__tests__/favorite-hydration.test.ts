import type { ListingSummary } from "@proppy/shared/types";
import { describe, expect, it } from "vitest";
import { favoriteIdsFromListings, isInitiallyFavorited } from "../favorite-hydration";

const favoriteListing = { id: "11111111-1111-4111-8111-111111111111" } as ListingSummary;
const otherListing = { id: "22222222-2222-4222-8222-222222222222" } as ListingSummary;

describe("favorite hydration", () => {
  it("marks search result cards as initially favorited when a favorite exists", () => {
    const favoriteIds = favoriteIdsFromListings([favoriteListing]);

    expect(isInitiallyFavorited(favoriteListing.id, favoriteIds)).toBe(true);
    expect(isInitiallyFavorited(otherListing.id, favoriteIds)).toBe(false);
  });
});
