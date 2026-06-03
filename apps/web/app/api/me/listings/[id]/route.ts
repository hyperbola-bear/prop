import { NextRequest } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  addresses,
  listingFloorPlans,
  listingHdb,
  listingPhotos,
  listingRental,
  listings
} from "../../../../../../../packages/db/schema";
import { db } from "../../../../../lib/db";
import { requireListingMutationAccess } from "../../../../../lib/listing-mutations";
import { jsonResponse, mapError, requireAuth } from "../../../../../lib/route-helpers";
import { presignPhotoGetUrl } from "../../../../../lib/storage";

const listingIdSchema = z.uuid();

type ListingRouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function GET(request: NextRequest, context: ListingRouteContext) {
  try {
    const params = await context.params;
    const listingId = listingIdSchema.parse(params.id);
    const currentUser = await requireAuth(request);
    await requireListingMutationAccess(listingId, currentUser);

    const [row] = await db
      .select({
        id: listings.id,
        title: listings.title,
        description: listings.description,
        status: listings.status,
        ownerUserId: listings.ownerUserId,
        agentUserId: listings.agentUserId,
        representedVia: listings.representedVia,
        priceSgd: listings.priceSgd,
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
        furnishing: listingRental.furnishing
      })
      .from(listings)
      .leftJoin(addresses, eq(addresses.id, listings.addressId))
      .leftJoin(listingHdb, eq(listingHdb.listingId, listings.id))
      .leftJoin(listingRental, eq(listingRental.listingId, listings.id))
      .where(and(eq(listings.id, listingId), isNull(listings.deletedAt)))
      .limit(1);

    const photos = await db
      .select({
        id: listingPhotos.id,
        objectPath: listingPhotos.s3Key,
        thumbnailObjectPath: listingPhotos.thumbnailS3Key,
        roomTag: listingPhotos.roomTag,
        sortOrder: listingPhotos.sortOrder
      })
      .from(listingPhotos)
      .where(and(eq(listingPhotos.listingId, listingId), isNull(listingPhotos.deletedAt)))
      .orderBy(asc(listingPhotos.sortOrder));

    const [floorPlan] = await db
      .select({
        id: listingFloorPlans.id,
        objectPath: listingFloorPlans.s3Key
      })
      .from(listingFloorPlans)
      .where(and(eq(listingFloorPlans.listingId, listingId), isNull(listingFloorPlans.deletedAt)))
      .orderBy(asc(listingFloorPlans.sortOrder))
      .limit(1);

    return jsonResponse({
      ...row,
      priceSgd: row ? Number(row.priceSgd) : 0,
      photos: await Promise.all(
        photos.map(async (photo) => ({
          ...photo,
          url: await presignPhotoGetUrl(photo.thumbnailObjectPath ?? photo.objectPath)
        }))
      ),
      floorPlan: floorPlan
        ? {
            ...floorPlan,
            url: await presignPhotoGetUrl(floorPlan.objectPath)
          }
        : null
    });
  } catch (error) {
    return mapError(error);
  }
}
