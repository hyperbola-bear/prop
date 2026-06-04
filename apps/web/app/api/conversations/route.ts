import { NextRequest } from "next/server";
import { and, count, desc, eq, isNull, ne, or } from "drizzle-orm";
import { conversations, messages } from "../../../../../packages/db/schema";
import { db } from "../../../lib/db";
import { serializeConversation } from "../../../lib/messaging";
import { jsonResponse, mapError, optionsResponse, requireAuth } from "../../../lib/route-helpers";

async function unreadCount(conversationId: string, userId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        ne(messages.senderUserId, userId),
        isNull(messages.readAt),
        isNull(messages.deletedAt)
      )
    );
  return row?.value ?? 0;
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireAuth(request);
    const rows = await db
      .select()
      .from(conversations)
      .where(
        and(
          or(
            eq(conversations.buyerUserId, currentUser.userId),
            eq(conversations.sellerUserId, currentUser.userId)
          ),
          isNull(conversations.deletedAt)
        )
      )
      .orderBy(desc(conversations.lastMessageAt), desc(conversations.createdAt));

    const items = await Promise.all(
      rows.map(async (row) => serializeConversation(row, await unreadCount(row.id, currentUser.userId)))
    );

    return jsonResponse({ items });
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
