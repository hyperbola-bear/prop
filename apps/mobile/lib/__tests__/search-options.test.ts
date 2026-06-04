import { describe, expect, it } from "vitest";
import {
  filtersFromParams,
  listingOptionsFromParams,
  paramsFromSavedQuery,
  queryStringFromFilters,
  savedQueryFromParams
} from "../search-options";

describe("mobile search options", () => {
  it("converts Expo Router params into shared listing options", () => {
    expect(
      listingOptionsFromParams({
        flat_type: "4-room",
        price_max: "3000",
        room_only: "true",
        sort: "price_asc",
        town: "TAMPINES"
      })
    ).toEqual({
      flat_type: "4-room",
      limit: 50,
      price_max: 3000,
      room_only: true,
      sort: "price_asc",
      town: "TAMPINES"
    });
  });

  it("builds URLs without default sort and grid view noise", () => {
    const filters = filtersFromParams({
      flat_type: "4-room",
      sort: "newest",
      town: "TAMPINES",
      view: "grid"
    });

    expect(queryStringFromFilters(filters)).toBe("town=TAMPINES&flat_type=4-room");
  });

  it("serializes saved search queries with typed values", () => {
    expect(
      savedQueryFromParams({
        bedrooms: "3",
        q: "balcony",
        radius_km: "1",
        room_only: "false"
      })
    ).toEqual({
      bedrooms: 3,
      q: "balcony",
      radius_km: 1,
      room_only: false
    });
  });

  it("reopens saved searches with the original query string", () => {
    expect(paramsFromSavedQuery({ flat_type: "4-room", town: "TAMPINES" })).toBe(
      "flat_type=4-room&town=TAMPINES"
    );
  });
});
