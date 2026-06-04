import { and, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import { ForbiddenError, NotFoundError } from "./route-helpers";
import { conversations, messages } from "../../../packages/db/schema";

export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;

export async function requireConversationParticipant(
  conversationId: string,
  userId: string
): Promise<ConversationRow> {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), isNull(conversations.deletedAt)))
    .limit(1);

  if (!conversation) {
    throw new NotFoundError("Conversation not found");
  }

  if (conversation.buyerUserId !== userId && conversation.sellerUserId !== userId) {
    throw new ForbiddenError("Only conversation participants can access this conversation");
  }

  return conversation;
}

export function serializeMessage(row: MessageRow) {
  return {
    id: row.id,
    conversationId: row.conversationId,
    senderUserId: row.senderUserId,
    body: row.body,
    scam_flags: row.scamFlags,
    scam_score: row.scamScore,
    created_at: row.createdAt?.toISOString() ?? null,
    read_at: row.readAt?.toISOString() ?? null
  };
}

export function serializeConversation(
  row: ConversationRow,
  unreadCount: number,
  lastMessageAt?: Date | null
) {
  return {
    id: row.id,
    listingId: row.listingId,
    buyerUserId: row.buyerUserId,
    sellerUserId: row.sellerUserId,
    last_message_at: (lastMessageAt ?? row.lastMessageAt)?.toISOString() ?? null,
    unread_count: unreadCount,
    created_at: row.createdAt?.toISOString() ?? null
  };
}
