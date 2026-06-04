import { Buffer } from "node:buffer";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
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
import { buildPublicListingConditions } from "../../../packages/shared/src/search-query";
import { db } from "./db";
import { presignPhotoGetUrl } from "./storage";

type CursorPayload = {
  sort?: "newest" | "price_asc" | "price_desc" | "refreshed";
  id: string;
  publishedAt?: string | null | undefined;
  priceSgd?: string | undefined;
  refreshedAt?: string | null | undefined;
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
    if (typeof parsed.publishedAt === "string" && Number.isNaN(Date.parse(parsed.publishedAt))) {
      throw new InvalidCursorError();
    }
    if (typeof parsed.refreshedAt === "string" && Number.isNaN(Date.parse(parsed.refreshedAt))) {
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
    let price: bigint;
    try {
      price = BigInt(decodedCursor.priceSgd);
    } catch {
      throw new InvalidCursorError();
    }
    const priceComparison =
      sort === "price_asc" ? gt(listings.priceSgd, price) : lt(listings.priceSgd, price);
    const idComparison =
      sort === "price_asc" ? gt(listings.id, decodedCursor.id) : lt(listings.id, decodedCursor.id);
    return or(priceComparison, and(eq(listings.priceSgd, price), idComparison));
  }

  if (sort === "refreshed") {
    if (decodedCursor.refreshedAt === undefined || !decodedCursor.publishedAt) {
      throw new InvalidCursorError();
    }
    const publishedAt = decodedCursor.publishedAt;
    if (decodedCursor.refreshedAt === null) {
      return sql`(
        ${listings.refreshedAt} is null
        and (
          ${listings.publishedAt} < ${publishedAt}::timestamptz
          or (
            ${listings.publishedAt} = ${publishedAt}::timestamptz
            and ${listings.id} < ${decodedCursor.id}
          )
        )
      )`;
    }
    const refreshedAt = decodedCursor.refreshedAt;
    return sql`(
      ${listings.refreshedAt} is null
      or ${listings.refreshedAt} < ${refreshedAt}::timestamptz
      or (
        ${listings.refreshedAt} = ${refreshedAt}::timestamptz
        and (
          ${listings.publishedAt} < ${publishedAt}::timestamptz
          or (
            ${listings.publishedAt} = ${publishedAt}::timestamptz
            and ${listings.id} < ${decodedCursor.id}
          )
        )
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
  const conditions = buildPublicListingConditions(options);

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

function mrtPattern(nearMrt: string): string {
  return nearMrt.trim();
}

function radiusMetres(radiusKm: number | undefined): number {
  return Math.round((radiusKm ?? 1) * 1000);
}

function distanceToMrtSelect(options: PublicListingOptions) {
  if (!options.near_mrt) {
    return sql<number | null>`null`;
  }
  const pattern = mrtPattern(options.near_mrt);
  const radiusM = radiusMetres(options.radius_km);
  return sql<number | null>`(
    select round(min(ST_Distance(
      ${addresses.location}::geography,
      ST_SetSRID(ST_MakePoint(ST_X(mrt.geom), ST_Y(mrt.geom)), 4326)::geography
    )))::int
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
    return [
      sql`${listings.refreshedAt} desc nulls last`,
      sql`${listings.publishedAt} desc nulls last`,
      desc(listings.id)
    ];
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
  latitude: string | null;
  longitude: string | null;
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
    latitude: row.latitude ? Number(row.latitude) : null,
    longitude: row.longitude ? Number(row.longitude) : null,
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
    return row.publishedAt
      ? encodeCursor({
          sort,
          id: row.id,
          refreshedAt: row.refreshedAt?.toISOString() ?? null,
          publishedAt: row.publishedAt.toISOString()
        })
      : null;
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
      latitude: addresses.latitude,
      longitude: addresses.longitude,
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
      latitude: addresses.latitude,
      longitude: addresses.longitude,
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
      latitude: addresses.latitude,
      longitude: addresses.longitude,
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

export async function getFavoriteListingIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ listingId: favorites.listingId })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), isNull(favorites.deletedAt)));

  return new Set(rows.map((row) => row.listingId));
}

export { InvalidCursorError };
