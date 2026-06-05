import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  listings,
  sellerPropertyVerifications
} from "../../../../../../../packages/db/schema";
import { sellerVerificationSchema } from "../../../../../../../packages/shared/src/schemas";
import { db } from "../../../../../lib/db";
import { requireListingMutationAccess } from "../../../../../lib/listing-mutations";
import { jsonResponse, mapError, NotFoundError, optionsResponse, requireAuth } from "../../../../../lib/route-helpers";

const listingIdSchema = z.uuid();

type SellerVerificationRouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function POST(request: NextRequest, context: SellerVerificationRouteContext) {
  try {
    const currentUser = await requireAuth(request);
    const params = await context.params;
    const listingId = listingIdSchema.parse(params.id);
    const accessListing = await requireListingMutationAccess(listingId, currentUser);
    const body = sellerVerificationSchema.parse(await request.json().catch(() => ({})));

    const [listing] = await db
      .select({
        addressId: listings.addressId
      })
      .from(listings)
      .where(and(eq(listings.id, listingId), isNull(listings.deletedAt)))
      .limit(1);

    if (!listing) {
      throw new NotFoundError("Listing not found");
    }

    const now = new Date();
    const [created] = await db
      .insert(sellerPropertyVerifications)
      .values({
        sellerUserId: accessListing.ownerUserId,
        listingId,
        addressId: listing.addressId,
        documentS3Key: body.documentKey,
        status: "pending",
        createdAt: now,
        updatedAt: now
      })
      .returning({
        id: sellerPropertyVerifications.id,
        status: sellerPropertyVerifications.status
      });

    if (!created) {
      throw new Error("Seller verification insert failed");
    }

    return jsonResponse(created, { status: 201 });
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
