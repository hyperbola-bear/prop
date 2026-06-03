import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  listingHdb,
  listingRental,
  listings
} from "../../../../../../packages/db/schema";
import {
  listingDetailSchema,
  patchListingSchema
} from "../../../../../../packages/shared/src/schemas";
import { publicJson, publicOptions } from "../../_cors";
import { getPublicListingDetail } from "../../../../lib/listings";
import { db } from "../../../../lib/db";
import { requireListingMutationAccess } from "../../../../lib/listing-mutations";
import { jsonResponse, mapError, requireAuth } from "../../../../lib/route-helpers";

const listingIdSchema = z.uuid();

type ListingRouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function GET(_request: NextRequest, context: ListingRouteContext) {
  const params = await context.params;
  const parsedId = listingIdSchema.safeParse(params.id);

  if (!parsedId.success) {
    return publicJson(
      {
        error: {
          code: "not_found",
          message: "Listing not found"
        }
      },
      { status: 404 }
    );
  }

  const listing = await getPublicListingDetail(parsedId.data);

  if (!listing) {
    return publicJson(
      {
        error: {
          code: "not_found",
          message: "Listing not found"
        }
      },
      { status: 404 }
    );
  }

  return publicJson(listingDetailSchema.parse(listing));
}

export async function PATCH(request: NextRequest, context: ListingRouteContext) {
  try {
    const params = await context.params;
    const listingId = listingIdSchema.parse(params.id);
    const currentUser = await requireAuth(request);
    await requireListingMutationAccess(listingId, currentUser);
    const body = patchListingSchema.parse(await request.json());
    const now = new Date();

    const listingPatch: Partial<typeof listings.$inferInsert> = {};
    if (body.title !== undefined) listingPatch.title = body.title;
    if (body.description !== undefined) listingPatch.description = body.description;
    if (body.priceSgd !== undefined) listingPatch.priceSgd = BigInt(body.priceSgd);
    if (body.addressId !== undefined) listingPatch.addressId = body.addressId;
    if (body.bedrooms !== undefined) listingPatch.bedrooms = body.bedrooms;
    if (body.bathrooms !== undefined) listingPatch.bathrooms = body.bathrooms;

    await db.transaction(async (tx) => {
      if (Object.keys(listingPatch).length > 0) {
        await tx
          .update(listings)
          .set({ ...listingPatch, updatedAt: now })
          .where(eq(listings.id, listingId));
      }

      const rentalPatch: Partial<typeof listingRental.$inferInsert> = {};
      if (body.leaseMonths !== undefined) rentalPatch.leaseMonths = body.leaseMonths;
      if (body.availableFrom !== undefined) rentalPatch.availableFrom = body.availableFrom;
      if (body.furnishing !== undefined) rentalPatch.furnishing = body.furnishing;
      if (body.roomOnly !== undefined) rentalPatch.roomOnly = body.roomOnly;

      if (Object.keys(rentalPatch).length > 0) {
        await tx
          .insert(listingRental)
          .values({
            listingId,
            leaseMonths: body.leaseMonths ?? 12,
            availableFrom: body.availableFrom ?? new Date().toISOString().slice(0, 10),
            furnishing: body.furnishing ?? "Unfurnished",
            roomOnly: body.roomOnly ?? false
          })
          .onConflictDoUpdate({
            target: listingRental.listingId,
            set: { ...rentalPatch, updatedAt: now }
          });
      }

      const hdbPatch: Partial<typeof listingHdb.$inferInsert> = {};
      if (body.flatType !== undefined) hdbPatch.flatType = body.flatType;
      if (body.flatModel !== undefined) hdbPatch.flatModel = body.flatModel;
      if (body.floorLevelBand !== undefined) hdbPatch.floorLevelBand = body.floorLevelBand;
      if (body.floorAreaSqft !== undefined) hdbPatch.floorAreaSqft = body.floorAreaSqft;
      if (body.blockId !== undefined) hdbPatch.blockId = body.blockId;
      if (body.unitId !== undefined) hdbPatch.unitId = body.unitId;

      if (Object.keys(hdbPatch).length > 0) {
        await tx
          .insert(listingHdb)
          .values({
            listingId,
            flatType: body.flatType ?? "3-room",
            floorAreaSqft: body.floorAreaSqft ?? 1,
            flatModel: body.flatModel,
            floorLevelBand: body.floorLevelBand,
            blockId: body.blockId,
            unitId: body.unitId
          })
          .onConflictDoUpdate({
            target: listingHdb.listingId,
            set: { ...hdbPatch, updatedAt: now }
          });
      }
    });

    return jsonResponse({ id: listingId, status: "updated" });
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return publicOptions();
}
