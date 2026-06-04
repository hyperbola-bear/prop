import { NextRequest } from "next/server";
import { and, eq, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { messages } from "../../../../../../../packages/db/schema";
import { db } from "../../../../../lib/db";
import { requireConversationParticipant } from "../../../../../lib/messaging";
import { jsonResponse, mapError, optionsResponse, requireAuth } from "../../../../../lib/route-helpers";

const conversationIdSchema = z.uuid();

type ReadRouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function PATCH(request: NextRequest, context: ReadRouteContext) {
  try {
    const currentUser = await requireAuth(request);
    const params = await context.params;
    const conversationId = conversationIdSchema.parse(params.id);
    await requireConversationParticipant(conversationId, currentUser.userId);

    const now = new Date();
    const updatedRows = await db
      .update(messages)
      .set({ readAt: now, updatedAt: now })
      .where(
        and(
          eq(messages.conversationId, conversationId),
          ne(messages.senderUserId, currentUser.userId),
          isNull(messages.readAt),
          isNull(messages.deletedAt)
        )
      )
      .returning({ id: messages.id });

    return jsonResponse({ updated: updatedRows.length });
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
