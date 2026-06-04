import {
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
  type SQL
} from "drizzle-orm";
import {
  addresses,
  listingHdb,
  listingRental,
  listings
} from "@proppy/db/schema";
import { listingsQuerySchema, savedSearchQuerySchema } from "../schemas/listings";

export const PUBLIC_LISTING_STATUSES = ["published", "active"] as const;

export type ListingSearchFilters = {
  town?: string | undefined;
  flat_type?: string | undefined;
  bedrooms?: number | undefined;
  price_min?: number | undefined;
  price_max?: number | undefined;
  lease_min_months?: number | undefined;
  available_from?: string | undefined;
  furnishing?: string | undefined;
  room_only?: boolean | undefined;
  q?: string | undefined;
  near_mrt?: string | undefined;
  radius_km?: number | undefined;
};

export function flatTypesForBedrooms(bedrooms: number): string[] {
  if (bedrooms <= 1) {
    return ["1-room", "2-room"];
  }
  if (bedrooms === 2) {
    return ["3-room"];
  }
  if (bedrooms === 3) {
    return ["4-room", "5-room"];
  }
  if (bedrooms === 4) {
    return ["Executive"];
  }
  return [];
}

export function toEnglishTsQuery(q: string): string | null {
  const terms = q
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((term) => term.length > 0)
    .slice(0, 8);
  if (!terms || terms.length === 0) {
    return null;
  }
  return terms.join(" | ");
}

export function mrtPattern(nearMrt: string): string {
  return nearMrt.trim();
}

export function radiusMetres(radiusKm: number | undefined): number {
  return Math.round((radiusKm ?? 1) * 1000);
}

export function buildPublicListingConditions(options: ListingSearchFilters): SQL[] {
  const conditions: SQL[] = [
    isNull(listings.deletedAt),
    isNotNull(listings.publishedAt),
    inArray(listings.status, [...PUBLIC_LISTING_STATUSES])
  ];

  if (options.town) {
    conditions.push(eq(addresses.town, options.town.toUpperCase()));
  }
  if (options.flat_type) {
    conditions.push(eq(listingHdb.flatType, options.flat_type));
  }
  if (options.bedrooms !== undefined) {
    const flatTypes = flatTypesForBedrooms(options.bedrooms);
    const bedroomConditions: SQL[] = [eq(listings.bedrooms, options.bedrooms)];
    if (flatTypes.length > 0) {
      bedroomConditions.push(inArray(listingHdb.flatType, flatTypes));
    }
    const bedroomCondition = or(...bedroomConditions);
    if (bedroomCondition) {
      conditions.push(bedroomCondition);
    }
  }
  if (options.price_min !== undefined) {
    conditions.push(gte(listings.priceSgd, BigInt(options.price_min)));
  }
  if (options.price_max !== undefined) {
    conditions.push(lte(listings.priceSgd, BigInt(options.price_max)));
  }
  if (options.lease_min_months !== undefined) {
    conditions.push(gte(listingRental.leaseMonths, options.lease_min_months));
  }
  if (options.available_from) {
    conditions.push(gte(listingRental.availableFrom, options.available_from));
  }
  if (options.furnishing) {
    conditions.push(eq(listingRental.furnishing, options.furnishing));
  }
  if (options.room_only !== undefined) {
    conditions.push(eq(listingRental.roomOnly, options.room_only));
  }
  if (options.q) {
    const tsQuery = toEnglishTsQuery(options.q);
    if (tsQuery) {
      conditions.push(sql`${listings.searchVector} @@ to_tsquery('english', ${tsQuery})`);
    }
  }
  if (options.near_mrt) {
    const pattern = mrtPattern(options.near_mrt);
    const radiusM = radiusMetres(options.radius_km);
    conditions.push(sql`${addresses.location} is not null`);
    conditions.push(sql`exists (
      select 1
      from external.onemap_amenities mrt
      where mrt.amenity_type = 'MRT'
        and mrt.name ilike ${pattern}
        and ST_DWithin(
          ${addresses.location}::geography,
          ST_SetSRID(ST_MakePoint(ST_X(mrt.geom), ST_Y(mrt.geom)), 4326)::geography,
          ${radiusM}
        )
        and ST_Distance(
          ${addresses.location}::geography,
          ST_SetSRID(ST_MakePoint(ST_X(mrt.geom), ST_Y(mrt.geom)), 4326)::geography
        ) <= ${radiusM}
    )`);
  }

  return conditions;
}

export function savedSearchQueryToListingFilters(query: unknown): ListingSearchFilters {
  const parsedQuery = savedSearchQuerySchema.parse(query);
  const params: Record<string, string> = {};

  for (const [key, value] of Object.entries(parsedQuery)) {
    if (value === undefined || key === "cursor" || key === "limit" || key === "sort" || key === "view") {
      continue;
    }
    params[key] = String(value);
  }

  const parsedListingQuery = listingsQuerySchema.parse(params);
  return {
    town: parsedListingQuery.town,
    flat_type: parsedListingQuery.flat_type,
    bedrooms: parsedListingQuery.bedrooms,
    price_min: parsedListingQuery.price_min,
    price_max: parsedListingQuery.price_max,
    lease_min_months: parsedListingQuery.lease_min_months,
    available_from: parsedListingQuery.available_from,
    furnishing: parsedListingQuery.furnishing,
    room_only: parsedListingQuery.room_only,
    q: parsedListingQuery.q,
    near_mrt: parsedListingQuery.near_mrt,
    radius_km: parsedListingQuery.radius_km
  };
}
