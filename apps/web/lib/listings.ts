import { Buffer } from "node:buffer";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
  type SQL
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  addresses,
  favorites,
  listingHdb,
  listingPhotos,
  listingRental,
  listings,
  users
} from "../../../packages/db/schema";
import type {
  ListingDetail,
  ListingPhoto,
  ListingsResponse,
  ListingSummary
} from "../../../packages/shared/src/types";
import { db } from "./db";
import { presignPhotoGetUrl } from "./storage";

const PUBLIC_LISTING_STATUSES = ["published", "active"] as const;

type CursorPayload = {
  sort?: "newest" | "price_asc" | "price_desc" | "refreshed";
  id: string;
  publishedAt?: string | undefined;
  priceSgd?: string | undefined;
  refreshedAt?: string | undefined;
};

class InvalidCursorError extends Error {
  constructor() {
    super("Invalid listing cursor");
    this.name = "InvalidCursorError";
  }
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(cursor: string | null): CursorPayload | null {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<CursorPayload>;
    if (!parsed.id) {
      throw new InvalidCursorError();
    }
    if (parsed.publishedAt && Number.isNaN(Date.parse(parsed.publishedAt))) {
      throw new InvalidCursorError();
    }
    if (parsed.refreshedAt && Number.isNaN(Date.parse(parsed.refreshedAt))) {
      throw new InvalidCursorError();
    }
    return {
      sort: parsed.sort ?? "newest",
      id: parsed.id,
      publishedAt: parsed.publishedAt,
      priceSgd: parsed.priceSgd,
      refreshedAt: parsed.refreshedAt
    };
  } catch {
    throw new InvalidCursorError();
  }
}

function cursorCondition(cursor: string | null, sort: ListingSort): SQL | undefined {
  const decodedCursor = decodeCursor(cursor);
  if (!decodedCursor) {
    return undefined;
  }
  if ((decodedCursor.sort ?? "newest") !== sort) {
    throw new InvalidCursorError();
  }

  if (sort === "price_asc" || sort === "price_desc") {
    if (!decodedCursor.priceSgd) {
      throw new InvalidCursorError();
    }
    const price = BigInt(decodedCursor.priceSgd);
    const priceComparison =
      sort === "price_asc" ? gt(listings.priceSgd, price) : lt(listings.priceSgd, price);
    const idComparison =
      sort === "price_asc" ? gt(listings.id, decodedCursor.id) : lt(listings.id, decodedCursor.id);
    return or(priceComparison, and(eq(listings.priceSgd, price), idComparison));
  }

  if (sort === "refreshed") {
    if (!decodedCursor.refreshedAt) {
      throw new InvalidCursorError();
    }
    const refreshedAt = new Date(decodedCursor.refreshedAt);
    return sql`(
      coalesce(${listings.refreshedAt}, ${listings.publishedAt}) < ${refreshedAt}
      or (
        coalesce(${listings.refreshedAt}, ${listings.publishedAt}) = ${refreshedAt}
        and ${listings.id} < ${decodedCursor.id}
      )
    )`;
  }

  if (!decodedCursor.publishedAt) {
    throw new InvalidCursorError();
  }
  const publishedAt = new Date(decodedCursor.publishedAt);
  return or(
    lt(listings.publishedAt, publishedAt),
    and(eq(listings.publishedAt, publishedAt), lt(listings.id, decodedCursor.id))
  );
}

function publicListingConditions(options: PublicListingOptions): SQL[] {
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
        and ST_DWithin(${addresses.location}::geography, mrt.geom::geography, ${radiusM})
    )`);
  }

  const cursorSql = cursorCondition(options.cursor, options.sort);
  if (cursorSql) {
    conditions.push(cursorSql);
  }

  return conditions;
}

type ListingSort = "newest" | "price_asc" | "price_desc" | "refreshed";

type PublicListingOptions = {
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
  sort: ListingSort;
  near_mrt?: string | undefined;
  radius_km?: number | undefined;
  view?: "grid" | "map" | undefined;
  limit: number;
  cursor: string | null;
};

function flatTypesForBedrooms(bedrooms: number): string[] {
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

function toEnglishTsQuery(q: string): string | null {
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

function mrtPattern(nearMrt: string): string {
  return `%${nearMrt.trim()}%`;
}

function radiusMetres(radiusKm: number | undefined): number {
  return Math.round((radiusKm ?? 1) * 1000);
}

function distanceToMrtSelect(options: PublicListingOptions) {
  if (!options.near_mrt) {
    return sql<number | null>`null`;
  }
  const pattern = mrtPattern(options.near_mrt);
  return sql<number | null>`(
    select round(min(ST_Distance(${addresses.location}::geography, mrt.geom::geography)))::int
    from external.onemap_amenities mrt
    where mrt.amenity_type = 'MRT'
      and mrt.name ilike ${pattern}
  )`;
}

function orderByForSort(sort: ListingSort): SQL[] {
  if (sort === "price_asc") {
    return [asc(listings.priceSgd), asc(listings.id)];
  }
  if (sort === "price_desc") {
    return [desc(listings.priceSgd), desc(listings.id)];
  }
  if (sort === "refreshed") {
    return [sql`coalesce(${listings.refreshedAt}, ${listings.publishedAt}) desc`, desc(listings.id)];
  }
  return [desc(listings.publishedAt), desc(listings.id)];
}

async function photosForListings(
  listingIds: string[],
  limitPerListing?: number
): Promise<Map<string, ListingPhoto[]>> {
  const grouped = new Map<string, ListingPhoto[]>(
    listingIds.map((listingId) => [listingId, []])
  );

  if (listingIds.length === 0) {
    return grouped;
  }

  const rows = await db
    .select({
      listingId: listingPhotos.listingId,
      objectPath: listingPhotos.s3Key,
      alt: listingPhotos.altText,
      sortOrder: listingPhotos.sortOrder
    })
    .from(listingPhotos)
    .where(and(isNull(listingPhotos.deletedAt), inArray(listingPhotos.listingId, listingIds)))
    .orderBy(asc(listingPhotos.listingId), asc(listingPhotos.sortOrder));

  for (const row of rows) {
    const current = grouped.get(row.listingId);
    if (!current) {
      continue;
    }
    if (limitPerListing !== undefined && current.length >= limitPerListing) {
      continue;
    }
    current.push({
      url: await presignPhotoGetUrl(row.objectPath),
      alt: row.alt
    });
  }

  return grouped;
}

type ListingRow = {
  id: string;
  title: string;
  description: string | null;
  priceSgd: bigint;
  listingType: string;
  propertyType: string;
  publishedAt: Date | null;
  refreshedAt: Date | null;
  bedrooms: number | null;
  addressBlock: string | null;
  street: string;
  postal: string | null;
  town: string;
  flatType: string;
  floorAreaSqft: number;
  leaseMonths: number;
  availableFrom: string;
  furnishing: string;
  roomOnly: boolean;
  distanceToMrtM: number | null;
};

function toSummary(row: ListingRow, photos: ListingPhoto[]): ListingSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price_sgd: Number(row.priceSgd),
    address: {
      block: row.addressBlock ?? "",
      street: row.street,
      postal: row.postal ?? "",
      town: row.town
    },
    photos,
    listing_type: row.listingType,
    property_type: row.propertyType,
    flat_type: row.flatType,
    bedrooms: row.bedrooms,
    floor_area_sqft: row.floorAreaSqft,
    lease_months: row.leaseMonths,
    available_from: row.availableFrom,
    furnishing: row.furnishing,
    room_only: row.roomOnly,
    published_at: row.publishedAt?.toISOString() ?? null,
    refreshed_at: row.refreshedAt?.toISOString() ?? null,
    distance_to_mrt_m:
      row.distanceToMrtM === null || row.distanceToMrtM === undefined
        ? null
        : Number(row.distanceToMrtM)
  };
}

function cursorForRow(row: ListingRow, sort: ListingSort): string | null {
  if (sort === "price_asc" || sort === "price_desc") {
    return encodeCursor({ sort, id: row.id, priceSgd: row.priceSgd.toString() });
  }
  if (sort === "refreshed") {
    const refreshedAt = row.refreshedAt ?? row.publishedAt;
    return refreshedAt ? encodeCursor({ sort, id: row.id, refreshedAt: refreshedAt.toISOString() }) : null;
  }
  return row.publishedAt
    ? encodeCursor({ sort, id: row.id, publishedAt: row.publishedAt.toISOString() })
    : null;
}

export async function getPublicListings(options: PublicListingOptions): Promise<ListingsResponse> {
  const rows = await db
    .select({
      id: listings.id,
      title: listings.title,
      description: listings.description,
      priceSgd: listings.priceSgd,
      listingType: listings.listingType,
      propertyType: listings.propertyType,
      publishedAt: listings.publishedAt,
      refreshedAt: listings.refreshedAt,
      bedrooms: listings.bedrooms,
      addressBlock: addresses.block,
      street: addresses.street,
      postal: addresses.postalCode,
      town: addresses.town,
      flatType: listingHdb.flatType,
      floorAreaSqft: listingHdb.floorAreaSqft,
      leaseMonths: listingRental.leaseMonths,
      availableFrom: listingRental.availableFrom,
      furnishing: listingRental.furnishing,
      roomOnly: listingRental.roomOnly,
      distanceToMrtM: distanceToMrtSelect(options)
    })
    .from(listings)
    .innerJoin(addresses, eq(listings.addressId, addresses.id))
    .innerJoin(listingRental, eq(listingRental.listingId, listings.id))
    .innerJoin(listingHdb, eq(listingHdb.listingId, listings.id))
    .where(and(...publicListingConditions(options)))
    .orderBy(...orderByForSort(options.sort))
    .limit(options.limit + 1);

  const visibleRows = rows.slice(0, options.limit);
  const photoMap = await photosForListings(
    visibleRows.map((row) => row.id),
    3
  );

  const nextRow = rows.length > options.limit ? visibleRows.at(-1) : undefined;
  const nextCursor = nextRow ? cursorForRow(nextRow, options.sort) : null;

  return {
    items: visibleRows.map((row) => toSummary(row, photoMap.get(row.id) ?? [])),
    cursor: nextCursor
  };
}

export async function getPublicListingDetail(id: string): Promise<ListingDetail | null> {
  const owner = alias(users, "listing_owner");
  const agent = alias(users, "listing_agent");

  const [row] = await db
    .select({
      id: listings.id,
      title: listings.title,
      description: listings.description,
      priceSgd: listings.priceSgd,
      listingType: listings.listingType,
      propertyType: listings.propertyType,
      publishedAt: listings.publishedAt,
      refreshedAt: listings.refreshedAt,
      bedrooms: listings.bedrooms,
      addressBlock: addresses.block,
      street: addresses.street,
      postal: addresses.postalCode,
      town: addresses.town,
      flatType: listingHdb.flatType,
      floorAreaSqft: listingHdb.floorAreaSqft,
      leaseMonths: listingRental.leaseMonths,
      availableFrom: listingRental.availableFrom,
      furnishing: listingRental.furnishing,
      roomOnly: listingRental.roomOnly,
      distanceToMrtM: sql<number | null>`null`,
      ownerUserId: listings.ownerUserId,
      ownerName: owner.name,
      agentUserId: listings.agentUserId,
      agentName: agent.name
    })
    .from(listings)
    .innerJoin(addresses, eq(listings.addressId, addresses.id))
    .innerJoin(listingRental, eq(listingRental.listingId, listings.id))
    .innerJoin(listingHdb, eq(listingHdb.listingId, listings.id))
    .innerJoin(owner, eq(listings.ownerUserId, owner.id))
    .leftJoin(agent, eq(listings.agentUserId, agent.id))
    .where(and(eq(listings.id, id), ...publicListingConditions({ sort: "newest", limit: 1, cursor: null })))
    .limit(1);

  if (!row) {
    return null;
  }

  const photoMap = await photosForListings([row.id]);
  const agentOrLandlord =
    row.agentUserId && row.agentName
      ? { id: row.agentUserId, name: row.agentName, type: "agent" as const }
      : { id: row.ownerUserId, name: row.ownerName, type: "landlord" as const };

  return {
    ...toSummary(row, photoMap.get(row.id) ?? []),
    description: row.description ?? "",
    floor_plan: null,
    agent_or_landlord: agentOrLandlord
  };
}

export async function getFavoriteListings(userId: string): Promise<{ items: ListingSummary[] }> {
  const rows = await db
    .select({
      id: listings.id,
      title: listings.title,
      description: listings.description,
      priceSgd: listings.priceSgd,
      listingType: listings.listingType,
      propertyType: listings.propertyType,
      publishedAt: listings.publishedAt,
      refreshedAt: listings.refreshedAt,
      bedrooms: listings.bedrooms,
      addressBlock: addresses.block,
      street: addresses.street,
      postal: addresses.postalCode,
      town: addresses.town,
      flatType: listingHdb.flatType,
      floorAreaSqft: listingHdb.floorAreaSqft,
      leaseMonths: listingRental.leaseMonths,
      availableFrom: listingRental.availableFrom,
      furnishing: listingRental.furnishing,
      roomOnly: listingRental.roomOnly,
      distanceToMrtM: sql<number | null>`null`
    })
    .from(favorites)
    .innerJoin(listings, eq(favorites.listingId, listings.id))
    .innerJoin(addresses, eq(listings.addressId, addresses.id))
    .innerJoin(listingRental, eq(listingRental.listingId, listings.id))
    .innerJoin(listingHdb, eq(listingHdb.listingId, listings.id))
    .where(
      and(
        eq(favorites.userId, userId),
        isNull(favorites.deletedAt),
        ...publicListingConditions({ sort: "newest", limit: 50, cursor: null })
      )
    )
    .orderBy(desc(favorites.createdAt), desc(favorites.id))
    .limit(50);

  const photoMap = await photosForListings(
    rows.map((row) => row.id),
    3
  );

  return {
    items: rows.map((row) => toSummary(row, photoMap.get(row.id) ?? []))
  };
}

export { InvalidCursorError };
