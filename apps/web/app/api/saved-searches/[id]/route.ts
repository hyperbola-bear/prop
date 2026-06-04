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
const patchSavedSearchSchema = z.object({
  notify_email: z.boolean().optional(),
  notifyEmail: z.boolean().optional()
}).refine((value) => value.notify_email !== undefined || value.notifyEmail !== undefined, {
  message: "notify_email is required",
  path: ["notify_email"]
});

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
        notifyEmail: body.notifyEmail ?? body.notify_email ?? false,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(savedSearches.id, id),
          eq(savedSearches.userId, currentUser.userId),
          isNull(savedSearches.deletedAt)
        )
      )
      .returning({
        id: savedSearches.id,
        notify_email: savedSearches.notifyEmail
      });

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

    return new NextResponse(JSON.stringify(updated), {
      status: 200,
      headers: {
        "content-type": "application/json",
        ...apiCorsHeaders,
        ...securityHeaders
      }
    });
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
