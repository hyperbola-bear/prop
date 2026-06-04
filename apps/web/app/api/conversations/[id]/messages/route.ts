import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { createConversationMessageSchema } from "../../../../../../../packages/shared/src/schemas";
import { scoreMessage } from "../../../../../../../packages/shared/src/scam-detection";
import { conversations, enquiries, messages } from "../../../../../../../packages/db/schema";
import { db } from "../../../../../lib/db";
import { requireConversationParticipant, serializeMessage } from "../../../../../lib/messaging";
import {
  jsonError,
  jsonResponse,
  mapError,
  optionsResponse,
  requireAuth
} from "../../../../../lib/route-helpers";
import { checkRateLimit, messageRateLimits } from "../../../../../lib/rate-limit";

const conversationIdSchema = z.uuid();

type MessageRouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function POST(request: NextRequest, context: MessageRouteContext) {
  try {
    const currentUser = await requireAuth(request);
    const params = await context.params;
    const conversationId = conversationIdSchema.parse(params.id);
    const conversation = await requireConversationParticipant(conversationId, currentUser.userId);
    const rateLimit = checkRateLimit(conversationId, messageRateLimits);
    if (!rateLimit.ok) {
      return jsonError(429, "rate_limited", "Try again later", undefined, {
        "Retry-After": String(rateLimit.retryAfterSec)
      });
    }

    const body = createConversationMessageSchema.parse(await request.json().catch(() => ({})));
    const now = new Date();
    const score = scoreMessage(body.body);

    const [created] = await db.transaction(async (tx) => {
      const [message] = await tx
        .insert(messages)
        .values({
          conversationId,
          senderUserId: currentUser.userId,
          body: body.body,
          scamFlags: score.scam_flags,
          scamScore: score.scam_score,
          createdAt: now,
          updatedAt: now
        })
        .returning();

      await tx
        .update(conversations)
        .set({ lastMessageAt: now, updatedAt: now })
        .where(eq(conversations.id, conversationId));

      if (conversation.sellerUserId === currentUser.userId) {
        await tx
          .update(enquiries)
          .set({ firstResponseAt: now, updatedAt: now })
          .where(
            and(
              eq(enquiries.conversationId, conversationId),
              eq(enquiries.buyerUserId, conversation.buyerUserId),
              isNull(enquiries.firstResponseAt),
              isNull(enquiries.deletedAt)
            )
          );
      }

      return [message];
    });

    if (!created) {
      throw new Error("Message insert failed");
    }

    return jsonResponse(serializeMessage(created), { status: 201 });
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
