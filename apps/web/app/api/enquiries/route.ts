import { NextRequest } from "next/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { createEnquirySchema } from "../../../../../packages/shared/src/schemas";
import { scoreMessage } from "../../../../../packages/shared/src/scam-detection";
import { conversations, enquiries, listings, messages } from "../../../../../packages/db/schema";
import { db } from "../../../lib/db";
import {
  assertConversationMessageRateLimit,
  mapConversationMessageRateLimitError
} from "../../../lib/message-rate-limit";
import {
  ForbiddenError,
  jsonResponse,
  mapError,
  NotFoundError,
  optionsResponse,
  requireAuth
} from "../../../lib/route-helpers";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAuth(request);
    const body = createEnquirySchema.parse(await request.json().catch(() => ({})));
    const [listing] = await db
      .select({
        id: listings.id,
        sellerUserId: listings.ownerUserId,
        priceSgd: listings.priceSgd
      })
      .from(listings)
      .where(
        and(
          eq(listings.id, body.listingId),
          inArray(listings.status, ["published", "active"]),
          isNull(listings.deletedAt)
        )
      )
      .limit(1);

    if (!listing) {
      throw new NotFoundError("Listing not found");
    }
    if (listing.sellerUserId === currentUser.userId) {
      throw new ForbiddenError("Sellers cannot enquire on their own listing");
    }

    const now = new Date();
    const score = scoreMessage(body.body, { listedPriceSgdCents: listing.priceSgd });

    const result = await db.transaction(async (tx) => {
      const [conversation] = await tx
        .insert(conversations)
        .values({
          listingId: listing.id,
          buyerUserId: currentUser.userId,
          sellerUserId: listing.sellerUserId,
          lastMessageAt: now,
          createdAt: now,
          updatedAt: now
        })
        .onConflictDoUpdate({
          target: [
            conversations.listingId,
            conversations.buyerUserId,
            conversations.sellerUserId
          ],
          set: {
            lastMessageAt: now,
            updatedAt: now,
            deletedAt: null
          }
        })
        .returning({ id: conversations.id });

      if (!conversation) {
        throw new Error("Conversation insert failed");
      }

      assertConversationMessageRateLimit(conversation.id);

      const [message] = await tx
        .insert(messages)
        .values({
          conversationId: conversation.id,
          senderUserId: currentUser.userId,
          body: body.body,
          scamFlags: score.scam_flags,
          scamScore: score.scam_score,
          createdAt: now,
          updatedAt: now
        })
        .returning({ id: messages.id });

      const [enquiry] = await tx
        .insert(enquiries)
        .values({
          listingId: listing.id,
          buyerUserId: currentUser.userId,
          conversationId: conversation.id,
          createdAt: now,
          updatedAt: now
        })
        .returning({ id: enquiries.id });

      if (!message || !enquiry) {
        throw new Error("Enquiry insert failed");
      }

      return {
        conversationId: conversation.id,
        messageId: message.id,
        enquiryId: enquiry.id
      };
    });

    return jsonResponse(result, { status: 201 });
  } catch (error) {
    const rateLimitResponse = mapConversationMessageRateLimitError(error);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
