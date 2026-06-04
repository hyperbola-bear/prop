import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ListingCard } from "./ListingCard";
import type { ListingSummary } from "../../../../packages/shared/src/types";

vi.mock("./FavoriteToggle", () => ({
  FavoriteToggle: () => <button type="button">Favorite</button>
}));

function listingFixture(overrides: Partial<ListingSummary> = {}): ListingSummary {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Refreshed Tampines listing",
    description: "Bright HDB rental",
    price_sgd: 320000,
    address: {
      block: "857",
      street: "Tampines Street 83",
      postal: "520857",
      town: "TAMPINES"
    },
    photos: [{ url: "https://example.test/photo.jpg", alt: "Living room" }],
    listing_type: "rental",
    property_type: "hdb",
    flat_type: "4-room",
    bedrooms: 3,
    floor_area_sqft: 990,
    lease_months: 12,
    available_from: "2026-06-01",
    furnishing: "Fully",
    room_only: false,
    published_at: "2026-06-01T00:00:00.000Z",
    refreshed_at: "2026-06-03T00:00:00.000Z",
    latitude: 1.3533,
    longitude: 103.9451,
    distance_to_mrt_m: null,
    ...overrides
  };
}

describe("ListingCard", () => {
  it("exposes published and refreshed timestamps as card data attributes", () => {
    const html = renderToStaticMarkup(
      <ListingCard listing={listingFixture()} />
    );

    expect(html).toContain('data-published-at="2026-06-01T00:00:00.000Z"');
    expect(html).toContain('data-refreshed-at="2026-06-03T00:00:00.000Z"');
  });

  it("renders an empty refreshed timestamp data attribute when refreshed_at is null", () => {
    const html = renderToStaticMarkup(
      <ListingCard listing={listingFixture({ refreshed_at: null })} />
    );

    expect(html).toContain('data-refreshed-at=""');
  });
});
