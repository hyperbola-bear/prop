import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { favorites, listings } from "../../../../../../../packages/db/schema";
import { db } from "../../../../../lib/db";
import {
  mapError,
  NotFoundError,
  optionsResponse,
  requireAuth,
  jsonResponse,
  apiCorsHeaders,
  securityHeaders
} from "../../../../../lib/route-helpers";

const listingIdSchema = z.uuid();

type FavoriteRouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

async function requireListingExists(listingId: string) {
  const [row] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(and(eq(listings.id, listingId), isNull(listings.deletedAt)))
    .limit(1);
  if (!row) {
    throw new NotFoundError("Listing not found");
  }
}

export async function POST(request: NextRequest, context: FavoriteRouteContext) {
  try {
    const currentUser = await requireAuth(request);
    const params = await context.params;
    const listingId = listingIdSchema.parse(params.id);
    await requireListingExists(listingId);
    const now = new Date();

    await db
      .insert(favorites)
      .values({
        userId: currentUser.userId,
        listingId,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [favorites.userId, favorites.listingId],
        set: {
          deletedAt: null,
          updatedAt: now
        }
      });

    return jsonResponse({ ok: true });
  } catch (error) {
    return mapError(error);
  }
}

export async function DELETE(request: NextRequest, context: FavoriteRouteContext) {
  try {
    const currentUser = await requireAuth(request);
    const params = await context.params;
    const listingId = listingIdSchema.parse(params.id);

    await db
      .update(favorites)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(favorites.userId, currentUser.userId),
          eq(favorites.listingId, listingId),
          isNull(favorites.deletedAt)
        )
      );

    return new NextResponse(null, {
      status: 204,
      headers: { ...apiCorsHeaders, ...securityHeaders }
    });
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
