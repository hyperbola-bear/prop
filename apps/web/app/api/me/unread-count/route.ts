import { NextRequest } from "next/server";
import { and, count, eq, isNull, ne, or } from "drizzle-orm";
import { conversations, messages } from "../../../../../../packages/db/schema";
import { db } from "../../../../lib/db";
import { jsonResponse, mapError, optionsResponse, requireAuth } from "../../../../lib/route-helpers";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireAuth(request);
    const [row] = await db
      .select({ value: count() })
      .from(messages)
      .innerJoin(conversations, eq(conversations.id, messages.conversationId))
      .where(
        and(
          or(
            eq(conversations.buyerUserId, currentUser.userId),
            eq(conversations.sellerUserId, currentUser.userId)
          ),
          ne(messages.senderUserId, currentUser.userId),
          isNull(messages.readAt),
          isNull(messages.deletedAt),
          isNull(conversations.deletedAt)
        )
      );

    return jsonResponse({ count: row?.value ?? 0 });
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
