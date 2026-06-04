import { NextRequest } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { messages } from "../../../../../../packages/db/schema";
import { db } from "../../../../lib/db";
import {
  requireConversationParticipant,
  serializeConversation,
  serializeMessage
} from "../../../../lib/messaging";
import { jsonResponse, mapError, optionsResponse, requireAuth } from "../../../../lib/route-helpers";

const conversationIdSchema = z.uuid();

type ConversationRouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function GET(request: NextRequest, context: ConversationRouteContext) {
  try {
    const currentUser = await requireAuth(request);
    const params = await context.params;
    const conversationId = conversationIdSchema.parse(params.id);
    const conversation = await requireConversationParticipant(conversationId, currentUser.userId);

    const rows = await db
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), isNull(messages.deletedAt)))
      .orderBy(asc(messages.createdAt), asc(messages.id));

    return jsonResponse({
      ...serializeConversation(conversation, 0),
      messages: rows.map(serializeMessage)
    });
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
