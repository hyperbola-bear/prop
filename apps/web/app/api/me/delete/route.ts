import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { listings, users } from "../../../../../../packages/db/schema";
import { db } from "../../../../lib/db";
import { jsonResponse, mapError, optionsResponse, requireAuth } from "../../../../lib/route-helpers";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAuth(request);
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(users.id, currentUser.userId), isNull(users.deletedAt)));

      await tx
        .update(listings)
        .set({ deletedAt: now, updatedAt: now })
        .where(and(eq(listings.ownerUserId, currentUser.userId), isNull(listings.deletedAt)));
    });

    return jsonResponse({ ok: true }, { status: 202 });
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
