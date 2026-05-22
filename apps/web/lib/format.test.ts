import { describe, expect, it } from "vitest";
import {
  bedroomsForFlatType,
  formatAvailableDate,
  formatSGD
} from "./format";

describe("formatSGD", () => {
  it("formats cents as whole-dollar Singapore currency for listing cards", () => {
    expect(formatSGD(280000)).toBe("S$2,800");
  });

  it("formats cents with two decimals when requested", () => {
    expect(formatSGD(280000, 2)).toBe("S$2,800.00");
  });
});

describe("formatAvailableDate", () => {
  it("formats ISO dates as dd MMM yyyy", () => {
    expect(formatAvailableDate("2026-03-21")).toBe("21 Mar 2026");
  });
});

describe("bedroomsForFlatType", () => {
  it("derives the public bedroom label from HDB flat type", () => {
    expect(bedroomsForFlatType("4-room")).toBe("3 bedrooms");
  });
});
