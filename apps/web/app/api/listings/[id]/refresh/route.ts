import { NextRequest } from "next/server";
import { z } from "zod";
import { requireListingMutationAccess, setListingStatus } from "../../../../../lib/listing-mutations";
import { jsonResponse, mapError, requireAuth } from "../../../../../lib/route-helpers";

const listingIdSchema = z.uuid();

type ListingRouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function POST(request: NextRequest, context: ListingRouteContext) {
  try {
    const params = await context.params;
    const listingId = listingIdSchema.parse(params.id);
    const currentUser = await requireAuth(request);
    await requireListingMutationAccess(listingId, currentUser);
    await setListingStatus(listingId, currentUser.userId, null, "refreshedAt", "refreshed");
    return jsonResponse({ refreshed: true });
  } catch (error) {
    return mapError(error);
  }
}
