export const HDB_TOWNS = [
  "ANG MO KIO",
  "BEDOK",
  "BISHAN",
  "BUKIT BATOK",
  "BUKIT MERAH",
  "BUKIT PANJANG",
  "CENTRAL",
  "CHOA CHU KANG",
  "CLEMENTI",
  "GEYLANG",
  "HOUGANG",
  "JURONG EAST",
  "JURONG WEST",
  "KALLANG/WHAMPOA",
  "MARINE PARADE",
  "PASIR RIS",
  "PUNGGOL",
  "QUEENSTOWN",
  "SEMBAWANG",
  "SENGKANG",
  "SERANGOON",
  "TAMPINES",
  "TOA PAYOH",
  "WOODLANDS",
  "YISHUN"
] as const;

export const FLAT_TYPES = [
  "1-room",
  "2-room",
  "3-room",
  "4-room",
  "5-room",
  "Executive"
] as const;

export const FURNISHING_OPTIONS = ["Unfurnished", "Partial", "Fully"] as const;

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
  { value: "refreshed", label: "Recently refreshed" }
] as const;

export type SearchSort = (typeof SORT_OPTIONS)[number]["value"];

export const MRT_OPTIONS = [
  "Tampines",
  "Toa Payoh",
  "Bishan",
  "Bedok",
  "Clementi",
  "Jurong East",
  "Punggol",
  "Sengkang",
  "Woodlands",
  "Yishun",
  "Queenstown",
  "Serangoon"
] as const;

export const RADIUS_KM_OPTIONS = ["0.5", "1", "2", "5"] as const;

export function sortLabel(value: string | null | undefined): string {
  return SORT_OPTIONS.find((option) => option.value === value)?.label ?? "Newest";
}

export function filteredQueryFromSearchParams(searchParams: URLSearchParams) {
  const ignoredKeys = new Set(["cursor"]);
  const query: Record<string, string | number | boolean> = {};

  for (const [key, value] of searchParams.entries()) {
    if (!value || ignoredKeys.has(key)) {
      continue;
    }
    if (key === "room_only") {
      query[key] = value === "true";
    } else if (["bedrooms", "price_min", "price_max", "lease_min_months", "radius_km", "limit"].includes(key)) {
      query[key] = Number(value);
    } else {
      query[key] = value;
    }
  }

  return query;
}
