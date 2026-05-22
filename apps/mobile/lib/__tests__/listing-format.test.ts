import { describe, expect, it } from "vitest";
import {
  bedroomsForFlatType,
  formatAvailableDate,
  formatListingPrice
} from "../listing-format";

describe("mobile listing formatting", () => {
  it("formats listing card prices with Singapore dollars and grouping", () => {
    expect(formatListingPrice(280000)).toBe("S$2,800");
  });

  it("formats available-from dates as dd MMM yyyy", () => {
    expect(formatAvailableDate("2026-03-21")).toBe("21 Mar 2026");
  });

  it("derives bedroom copy from HDB flat type labels", () => {
    expect(bedroomsForFlatType("4-room")).toBe("3 bedrooms");
  });
});
