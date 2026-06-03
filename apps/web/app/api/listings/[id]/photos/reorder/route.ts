import { NextRequest } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { listingPhotos } from "../../../../../../../../packages/db/schema";
import { reorderListingPhotosSchema } from "../../../../../../../../packages/shared/src/schemas";
import { db } from "../../../../../../lib/db";
import { requireListingMutationAccess } from "../../../../../../lib/listing-mutations";
import { ForbiddenError, jsonResponse, mapError, requireAuth } from "../../../../../../lib/route-helpers";

const listingIdSchema = z.uuid();

type ListingRouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function PATCH(request: NextRequest, context: ListingRouteContext) {
  try {
    const params = await context.params;
    const listingId = listingIdSchema.parse(params.id);
    const currentUser = await requireAuth(request);
    await requireListingMutationAccess(listingId, currentUser);
    const body = reorderListingPhotosSchema.parse(await request.json());

    const rows = await db
      .select({ id: listingPhotos.id })
      .from(listingPhotos)
      .where(
        and(
          eq(listingPhotos.listingId, listingId),
          isNull(listingPhotos.deletedAt),
          inArray(listingPhotos.id, body.orderedIds)
        )
      );

    if (rows.length !== body.orderedIds.length) {
      throw new ForbiddenError("Photo order contains ids outside this listing");
    }

    await db.transaction(async (tx) => {
      for (let index = 0; index < body.orderedIds.length; index += 1) {
        await tx
          .update(listingPhotos)
          .set({ sortOrder: -1_000 - index, updatedAt: new Date() })
          .where(eq(listingPhotos.id, body.orderedIds[index]!));
      }

      for (let index = 0; index < body.orderedIds.length; index += 1) {
        await tx
          .update(listingPhotos)
          .set({ sortOrder: index, updatedAt: new Date() })
          .where(eq(listingPhotos.id, body.orderedIds[index]!));
      }
    });

    return jsonResponse({ ok: true });
  } catch (error) {
    return mapError(error);
  }
}
