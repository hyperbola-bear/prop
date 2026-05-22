import { Buffer } from "node:buffer";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  addresses,
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
  publishedAt: string;
  id: string;
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
    if (!parsed.publishedAt || !parsed.id || Number.isNaN(Date.parse(parsed.publishedAt))) {
      throw new InvalidCursorError();
    }
    return { publishedAt: parsed.publishedAt, id: parsed.id };
  } catch {
    throw new InvalidCursorError();
  }
}

function publicListingConditions(cursor: string | null = null): SQL[] {
  const conditions: SQL[] = [
    isNull(listings.deletedAt),
    isNotNull(listings.publishedAt),
    inArray(listings.status, [...PUBLIC_LISTING_STATUSES])
  ];
  const decodedCursor = decodeCursor(cursor);

  if (decodedCursor) {
    const publishedAt = new Date(decodedCursor.publishedAt);
    const cursorCondition = or(
      lt(listings.publishedAt, publishedAt),
      and(eq(listings.publishedAt, publishedAt), lt(listings.id, decodedCursor.id))
    );
    if (cursorCondition) {
      conditions.push(cursorCondition);
    }
  }

  return conditions;
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
  priceSgd: bigint;
  listingType: string;
  propertyType: string;
  publishedAt: Date | null;
  addressBlock: string | null;
  street: string;
  postal: string | null;
  town: string;
  flatType: string;
  floorAreaSqft: number;
  leaseMonths: number;
  availableFrom: string;
};

function toSummary(row: ListingRow, photos: ListingPhoto[]): ListingSummary {
  return {
    id: row.id,
    title: row.title,
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
    floor_area_sqft: row.floorAreaSqft,
    lease_months: row.leaseMonths,
    available_from: row.availableFrom
  };
}

export async function getPublicListings(options: {
  limit: number;
  cursor: string | null;
}): Promise<ListingsResponse> {
  const rows = await db
    .select({
      id: listings.id,
      title: listings.title,
      priceSgd: listings.priceSgd,
      listingType: listings.listingType,
      propertyType: listings.propertyType,
      publishedAt: listings.publishedAt,
      addressBlock: addresses.block,
      street: addresses.street,
      postal: addresses.postalCode,
      town: addresses.town,
      flatType: listingHdb.flatType,
      floorAreaSqft: listingHdb.floorAreaSqft,
      leaseMonths: listingRental.leaseMonths,
      availableFrom: listingRental.availableFrom
    })
    .from(listings)
    .innerJoin(addresses, eq(listings.addressId, addresses.id))
    .innerJoin(listingRental, eq(listingRental.listingId, listings.id))
    .innerJoin(listingHdb, eq(listingHdb.listingId, listings.id))
    .where(and(...publicListingConditions(options.cursor)))
    .orderBy(desc(listings.publishedAt), desc(listings.id))
    .limit(options.limit + 1);

  const visibleRows = rows.slice(0, options.limit);
  const photoMap = await photosForListings(
    visibleRows.map((row) => row.id),
    3
  );

  const nextRow = rows.length > options.limit ? visibleRows.at(-1) : undefined;
  const nextCursor =
    nextRow?.publishedAt === null || nextRow?.publishedAt === undefined
      ? null
      : encodeCursor({ publishedAt: nextRow.publishedAt.toISOString(), id: nextRow.id });

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
      addressBlock: addresses.block,
      street: addresses.street,
      postal: addresses.postalCode,
      town: addresses.town,
      flatType: listingHdb.flatType,
      floorAreaSqft: listingHdb.floorAreaSqft,
      leaseMonths: listingRental.leaseMonths,
      availableFrom: listingRental.availableFrom,
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
    .where(and(eq(listings.id, id), ...publicListingConditions()))
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

export { InvalidCursorError };
