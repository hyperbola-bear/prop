import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { listingFloorPlanZones, listingFloorPlans } from "../../../../../../../packages/db/schema";
import { db } from "../../../../../lib/db";
import { requireListingMutationAccess } from "../../../../../lib/listing-mutations";
import { jsonResponse, mapError, requireAuth } from "../../../../../lib/route-helpers";
import { headStorageObject } from "../../../../../lib/storage";

const listingIdSchema = z.uuid();
const floorPlanSchema = z.object({
  key: z.string().min(1),
  zone: z
    .object({
      roomTag: z.enum(["Living", "Kitchen", "Bedroom", "Bathroom", "Balcony", "Utility", "Store"]),
      polygon: z.record(z.string(), z.unknown()).optional(),
      bbox: z.record(z.string(), z.unknown()).optional()
    })
    .optional()
});

type ListingRouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function POST(request: NextRequest, context: ListingRouteContext) {
  try {
    const params = await context.params;
    const listingId = listingIdSchema.parse(params.id);
    const currentUser = await requireAuth(request);
    await requireListingMutationAccess(listingId, currentUser);
    const body = floorPlanSchema.parse(await request.json());
    await headStorageObject(body.key);

    const [created] = await db
      .insert(listingFloorPlans)
      .values({
        listingId,
        s3Key: body.key,
        sortOrder: 0
      })
      .returning({ id: listingFloorPlans.id });

    if (!created) {
      throw new Error("Failed to insert floor plan");
    }

    if (body.zone) {
      await db.insert(listingFloorPlanZones).values({
        floorPlanId: created.id,
        roomTag: body.zone.roomTag,
        polygonGeojson:
          body.zone.polygon ??
          {
            type: "Polygon",
            coordinates: [
              [
                [20, 20],
                [220, 20],
                [220, 140],
                [20, 140],
                [20, 20]
              ]
            ]
          },
        bbox: body.zone.bbox ?? { x: 20, y: 20, width: 200, height: 120 }
      });
    }

    return jsonResponse({ id: created.id }, { status: 201 });
  } catch (error) {
    return mapError(error);
  }
}

export async function DELETE(request: NextRequest, context: ListingRouteContext) {
  try {
    const params = await context.params;
    const listingId = listingIdSchema.parse(params.id);
    const currentUser = await requireAuth(request);
    await requireListingMutationAccess(listingId, currentUser);
    await db.update(listingFloorPlans).set({ deletedAt: new Date() }).where(eq(listingFloorPlans.listingId, listingId));
    return jsonResponse({ ok: true });
  } catch (error) {
    return mapError(error);
  }
}
