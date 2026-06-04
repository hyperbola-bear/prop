import { NextRequest } from "next/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { savedSearches } from "../../../../../packages/db/schema";
import {
  createSavedSearchSchema,
  savedSearchesResponseSchema
} from "../../../../../packages/shared/src/schemas";
import { db } from "../../../lib/db";
import { jsonResponse, mapError, optionsResponse, requireAuth } from "../../../lib/route-helpers";

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

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireAuth(request);
    const rows = await db
      .select()
      .from(savedSearches)
      .where(and(eq(savedSearches.userId, currentUser.userId), isNull(savedSearches.deletedAt)))
      .orderBy(desc(savedSearches.createdAt), desc(savedSearches.id));

    return jsonResponse(
      savedSearchesResponseSchema.parse({
        items: rows.map(serializeSavedSearch)
      })
    );
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAuth(request);
    const body = createSavedSearchSchema.parse(await request.json().catch(() => ({})));
    const now = new Date();
    const [created] = await db
      .insert(savedSearches)
      .values({
        userId: currentUser.userId,
        name: body.name,
        query: body.query,
        notifyEmail: body.notifyEmail,
        lastRunAt: now
      })
      .returning();
    if (!created) {
      throw new Error("Saved search insert failed");
    }

    return jsonResponse(serializeSavedSearch(created), { status: 201 });
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
