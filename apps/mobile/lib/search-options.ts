import type { ListListingsOptions } from "@proppy/shared/api-client";

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

export const FILTER_KEYS = [
  "q",
  "town",
  "flat_type",
  "bedrooms",
  "price_min",
  "price_max",
  "lease_min_months",
  "available_from",
  "furnishing",
  "room_only",
  "near_mrt",
  "radius_km",
  "sort",
  "view"
] as const;

export type SearchFilterKey = (typeof FILTER_KEYS)[number];
export type SearchFilters = Record<SearchFilterKey, string>;
export type SavedSearchQuery = Record<string, string | number | boolean>;

const NUMERIC_QUERY_KEYS = new Set([
  "bedrooms",
  "price_min",
  "price_max",
  "lease_min_months",
  "radius_km",
  "limit"
]);

export function emptySearchFilters(): SearchFilters {
  return {
    q: "",
    town: "",
    flat_type: "",
    bedrooms: "",
    price_min: "",
    price_max: "",
    lease_min_months: "",
    available_from: "",
    furnishing: "",
    room_only: "",
    near_mrt: "",
    radius_km: "",
    sort: "newest",
    view: "grid"
  };
}

export function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export function filtersFromParams(
  params: Record<string, string | string[] | undefined>
): SearchFilters {
  const filters = emptySearchFilters();
  for (const key of FILTER_KEYS) {
    const value = firstParam(params[key]);
    if (value) {
      filters[key] = value;
    }
  }

  return filters;
}

export function queryStringFromFilters(filters: SearchFilters): string {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (!value || (key === "sort" && value === "newest") || (key === "view" && value === "grid")) {
      continue;
    }
    params.set(key, value);
  }

  return params.toString();
}

export function listingOptionsFromFilters(filters: SearchFilters): ListListingsOptions {
  const options: ListListingsOptions = { limit: 50 };
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (!value || (key === "sort" && value === "newest") || (key === "view" && value === "grid")) {
      continue;
    }

    if (key === "room_only") {
      options.room_only = value === "true";
    } else if (NUMERIC_QUERY_KEYS.has(key)) {
      (options as Record<string, number>)[key] = Number(value);
    } else {
      (options as Record<string, string>)[key] = value;
    }
  }

  return options;
}

export function listingOptionsFromParams(
  params: Record<string, string | string[] | undefined>
): ListListingsOptions {
  return listingOptionsFromFilters(filtersFromParams(params));
}

export function savedQueryFromFilters(filters: SearchFilters): SavedSearchQuery {
  const query: SavedSearchQuery = {};
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    if (!value || (key === "sort" && value === "newest") || (key === "view" && value === "grid")) {
      continue;
    }

    if (key === "room_only") {
      query[key] = value === "true";
    } else if (NUMERIC_QUERY_KEYS.has(key)) {
      query[key] = Number(value);
    } else {
      query[key] = value;
    }
  }

  return query;
}

export function savedQueryFromParams(
  params: Record<string, string | string[] | undefined>
): SavedSearchQuery {
  return savedQueryFromFilters(filtersFromParams(params));
}

export function paramsFromSavedQuery(query: SavedSearchQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    params.set(key, String(value));
  }

  return params.toString();
}

export function describeSavedQuery(query: SavedSearchQuery): string {
  const entries = Object.entries(query);
  if (entries.length === 0) {
    return "All rentals";
  }

  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(" · ");
}
