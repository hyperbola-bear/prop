import { describe, expect, it } from "vitest";
import {
  filteredQueryFromSearchParams,
  RADIUS_KM_OPTIONS,
  SORT_OPTIONS,
  sortLabel
} from "../search/search-options";

describe("search options", () => {
  it("exposes the required sort option values", () => {
    expect(SORT_OPTIONS.map((option) => option.value)).toEqual([
      "newest",
      "price_asc",
      "price_desc",
      "refreshed"
    ]);
  });

  it("maps sort values to user-facing labels", () => {
    expect(sortLabel("newest")).toBe("Newest");
    expect(sortLabel("price_asc")).toBe("Price ↑");
    expect(sortLabel("price_desc")).toBe("Price ↓");
    expect(sortLabel("refreshed")).toBe("Recently refreshed");
    expect(sortLabel("unknown")).toBe("Newest");
  });

  it("converts URL search params into a saved-search query payload", () => {
    const params = new URLSearchParams(
      "town=TAMPINES&flat_type=4-room&bedrooms=3&price_min=2000&room_only=true&cursor=abc"
    );

    expect(filteredQueryFromSearchParams(params)).toEqual({
      town: "TAMPINES",
      flat_type: "4-room",
      bedrooms: 3,
      price_min: 2000,
      room_only: true
    });
  });

  it("exposes the required MRT radius distances", () => {
    expect(RADIUS_KM_OPTIONS).toEqual(["0.5", "1", "2", "5"]);
  });
});
