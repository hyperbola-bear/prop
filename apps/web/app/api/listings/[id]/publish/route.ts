import { NextRequest } from "next/server";
import { and, count, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  listingEvents,
  listingHdb,
  listingPhotos,
  listingRental,
  listings
} from "../../../../../../../packages/db/schema";
import { db } from "../../../../../lib/db";
import { requireListingMutationAccess } from "../../../../../lib/listing-mutations";
import { jsonResponse, mapError, optionsResponse, requireAuth } from "../../../../../lib/route-helpers";

const listingIdSchema = z.uuid();

type ListingRouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: NextRequest, context: ListingRouteContext) {
  try {
    const params = await context.params;
    const listingId = listingIdSchema.parse(params.id);
    const currentUser = await requireAuth(request);
    await requireListingMutationAccess(listingId, currentUser);

    const [row] = await db
      .select({
        id: listings.id,
        addressId: listings.addressId,
        priceSgd: listings.priceSgd,
        flatType: listingHdb.flatType,
        blockId: listingHdb.blockId,
        leaseMonths: listingRental.leaseMonths,
        availableFrom: listingRental.availableFrom
      })
      .from(listings)
      .leftJoin(listingHdb, eq(listingHdb.listingId, listings.id))
      .leftJoin(listingRental, eq(listingRental.listingId, listings.id))
      .where(and(eq(listings.id, listingId), isNull(listings.deletedAt)))
      .limit(1);

    const [photoRow] = await db
      .select({ count: count() })
      .from(listingPhotos)
      .where(and(eq(listingPhotos.listingId, listingId), isNull(listingPhotos.deletedAt)));

    const missing: string[] = [];
    if (!photoRow || photoRow.count < 3) missing.push("photos");
    if (!row?.addressId || !row.blockId) missing.push("address");
    if (!row?.flatType) missing.push("flat_type");
    if (!row?.leaseMonths || row.leaseMonths < 1 || row.leaseMonths > 36) {
      missing.push("lease_months");
    }
    if (!row?.availableFrom || row.availableFrom < todayIsoDate()) {
      missing.push("available_from");
    }
    if (!row?.priceSgd || row.priceSgd < 10_000n || row.priceSgd > 5_000_000n) {
      missing.push("price_sgd");
    }

    if (missing.length > 0) {
      return jsonResponse(
        {
          error: "listing_incomplete",
          missing
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    await db.transaction(async (tx) => {
      await tx
        .update(listings)
        .set({
          status: "published",
          publishedAt: now,
          expiresAt,
          updatedAt: now
        })
        .where(eq(listings.id, listingId));

      await tx.insert(listingEvents).values({
        listingId,
        actorUserId: currentUser.userId,
        eventType: "published"
      });
    });

    return jsonResponse({ status: "published" });
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
