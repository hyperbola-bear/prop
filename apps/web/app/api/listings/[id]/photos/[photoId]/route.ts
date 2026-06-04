import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { listingPhotos } from "../../../../../../../../packages/db/schema";
import { updateListingPhotoRoomTagSchema } from "../../../../../../../../packages/shared/src/schemas";
import { db } from "../../../../../../lib/db";
import { requireListingMutationAccess } from "../../../../../../lib/listing-mutations";
import {
  jsonResponse,
  mapError,
  NotFoundError,
  optionsResponse,
  requireAuth
} from "../../../../../../lib/route-helpers";

const uuidSchema = z.uuid();

type ListingPhotoRouteContext = {
  params: Promise<{ id: string; photoId: string }> | { id: string; photoId: string };
};

export async function PATCH(request: NextRequest, context: ListingPhotoRouteContext) {
  try {
    const params = await context.params;
    const listingId = uuidSchema.parse(params.id);
    const photoId = uuidSchema.parse(params.photoId);
    const currentUser = await requireAuth(request);
    await requireListingMutationAccess(listingId, currentUser);
    const body = updateListingPhotoRoomTagSchema.parse(await request.json());

    const [updated] = await db
      .update(listingPhotos)
      .set({
        roomTag: body.roomTag,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(listingPhotos.id, photoId),
          eq(listingPhotos.listingId, listingId),
          isNull(listingPhotos.deletedAt)
        )
      )
      .returning({ id: listingPhotos.id, roomTag: listingPhotos.roomTag });

    if (!updated) {
      throw new NotFoundError("Photo not found");
    }

    return jsonResponse({ id: updated.id, roomTag: updated.roomTag });
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
