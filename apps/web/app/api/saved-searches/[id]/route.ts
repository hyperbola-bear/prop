import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { savedSearches } from "../../../../../../packages/db/schema";
import {
  patchSavedSearchSchema,
  savedSearchSchema
} from "../../../../../../packages/shared/src/schemas";
import { db } from "../../../../lib/db";
import {
  apiCorsHeaders,
  jsonResponse,
  mapError,
  optionsResponse,
  requireAuth,
  securityHeaders
} from "../../../../lib/route-helpers";

const savedSearchIdSchema = z.uuid();

function serializeSavedSearch(row: typeof savedSearches.$inferSelect) {
  return {
    id: row.id,
    user_id: row.userId,
    name: row.name,
    query: row.query as Record<string, string | number | boolean>,
    notify_email: row.notifyEmail,
    created_at: row.createdAt?.toISOString() ?? null,
    updated_at: row.updatedAt?.toISOString() ?? null,
    last_run_at: row.lastRunAt?.toISOString() ?? null
  };
}

type SavedSearchRouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function PATCH(request: NextRequest, context: SavedSearchRouteContext) {
  try {
    const currentUser = await requireAuth(request);
    const params = await context.params;
    const id = savedSearchIdSchema.parse(params.id);
    const body = patchSavedSearchSchema.parse(await request.json().catch(() => ({})));

    const [updated] = await db
      .update(savedSearches)
      .set({
        notifyEmail: body.notifyEmail,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(savedSearches.id, id),
          eq(savedSearches.userId, currentUser.userId),
          isNull(savedSearches.deletedAt)
        )
      )
      .returning();

    if (!updated) {
      return new NextResponse(
        JSON.stringify({ error: { code: "not_found", message: "Saved search not found" } }),
        {
          status: 404,
          headers: {
            "content-type": "application/json",
            ...apiCorsHeaders,
            ...securityHeaders
          }
        }
      );
    }

    return jsonResponse(savedSearchSchema.parse(serializeSavedSearch(updated)));
  } catch (error) {
    return mapError(error);
  }
}

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
