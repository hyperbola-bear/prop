import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { savedSearches } from "../../../../../../packages/db/schema";
import { db } from "../../../../lib/db";
import {
  apiCorsHeaders,
  mapError,
  optionsResponse,
  requireAuth,
  securityHeaders
} from "../../../../lib/route-helpers";

const savedSearchIdSchema = z.uuid();

type SavedSearchRouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function DELETE(request: NextRequest, context: SavedSearchRouteContext) {
  try {
    const currentUser = await requireAuth(request);
    const params = await context.params;
    const id = savedSearchIdSchema.parse(params.id);

    await db
      .update(savedSearches)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(savedSearches.id, id),
          eq(savedSearches.userId, currentUser.userId),
          isNull(savedSearches.deletedAt)
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
