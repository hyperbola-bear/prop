import { NextRequest } from "next/server";
import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import {
  addresses,
  listingHdb,
  listingPhotos,
  listingRental,
  listings
} from "../../../../../../packages/db/schema";
import { db } from "../../../../lib/db";
import { jsonResponse, mapError, requireAuth } from "../../../../lib/route-helpers";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireAuth(request);

    const rows = await db
      .select({
        id: listings.id,
        title: listings.title,
        description: listings.description,
        status: listings.status,
        ownerUserId: listings.ownerUserId,
        agentUserId: listings.agentUserId,
        representedVia: listings.representedVia,
        priceSgd: listings.priceSgd,
        publishedAt: listings.publishedAt,
        refreshedAt: listings.refreshedAt,
        rentedAt: listings.rentedAt,
        delistedAt: listings.delistedAt,
        addressId: listings.addressId,
        block: addresses.block,
        street: addresses.street,
        postal: addresses.postalCode,
        town: addresses.town,
        latitude: addresses.latitude,
        longitude: addresses.longitude,
        flatType: listingHdb.flatType,
        floorLevelBand: listingHdb.floorLevelBand,
        floorAreaSqft: listingHdb.floorAreaSqft,
        blockId: listingHdb.blockId,
        leaseMonths: listingRental.leaseMonths,
        availableFrom: listingRental.availableFrom,
        furnishing: listingRental.furnishing,
        photoCount: sql<number>`count(${listingPhotos.id})::int`
      })
      .from(listings)
      .leftJoin(addresses, eq(addresses.id, listings.addressId))
      .leftJoin(listingHdb, eq(listingHdb.listingId, listings.id))
      .leftJoin(listingRental, eq(listingRental.listingId, listings.id))
      .leftJoin(
        listingPhotos,
        and(eq(listingPhotos.listingId, listings.id), isNull(listingPhotos.deletedAt))
      )
      .where(
        and(
          isNull(listings.deletedAt),
          or(eq(listings.ownerUserId, currentUser.userId), eq(listings.agentUserId, currentUser.userId))
        )
      )
      .groupBy(
        listings.id,
        addresses.id,
        listingHdb.listingId,
        listingRental.listingId
      )
      .orderBy(asc(listings.createdAt));

    return jsonResponse({
      items: rows.map((row) => ({
        ...row,
        priceSgd: Number(row.priceSgd),
        publishedAt: row.publishedAt?.toISOString() ?? null,
        refreshedAt: row.refreshedAt?.toISOString() ?? null,
        rentedAt: row.rentedAt?.toISOString() ?? null,
        delistedAt: row.delistedAt?.toISOString() ?? null
      }))
    });
  } catch (error) {
    return mapError(error);
  }
}
