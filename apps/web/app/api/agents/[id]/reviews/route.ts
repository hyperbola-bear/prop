import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
  agentProfiles,
  agentReviews,
  messages,
  users
} from "../../../../../../../packages/db/schema";
import { agentReviewSchema } from "../../../../../../../packages/shared/src/schemas";
import { db } from "../../../../../lib/db";
import { jsonResponse, mapError, NotFoundError, optionsResponse, requireAuth } from "../../../../../lib/route-helpers";

const agentIdSchema = z.uuid();

type AgentReviewRouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

async function agentExists(agentId: string): Promise<boolean> {
  const [agent] = await db
    .select({ id: agentProfiles.userId })
    .from(agentProfiles)
    .innerJoin(users, eq(users.id, agentProfiles.userId))
    .where(and(eq(agentProfiles.userId, agentId), isNull(agentProfiles.deletedAt), isNull(users.deletedAt)))
    .limit(1);
  return Boolean(agent);
}

async function hasTwoSidedConversation(reviewerId: string, agentId: string): Promise<boolean> {
  const reviewerMessage = alias(messages, "reviewer_messages");
  const agentMessage = alias(messages, "agent_messages");
  const [row] = await db
    .select({ conversationId: reviewerMessage.conversationId })
    .from(reviewerMessage)
    .innerJoin(agentMessage, eq(agentMessage.conversationId, reviewerMessage.conversationId))
    .where(
      and(
        eq(reviewerMessage.senderUserId, reviewerId),
        eq(agentMessage.senderUserId, agentId),
        isNull(reviewerMessage.deletedAt),
        isNull(agentMessage.deletedAt)
      )
    )
    .limit(1);

  return Boolean(row);
}

export async function POST(request: NextRequest, context: AgentReviewRouteContext) {
  try {
    const currentUser = await requireAuth(request);
    const params = await context.params;
    const agentId = agentIdSchema.parse(params.id);
    const body = agentReviewSchema.parse(await request.json().catch(() => ({})));

    if (!(await agentExists(agentId))) {
      throw new NotFoundError("Agent not found");
    }

    const reviewType = (await hasTwoSidedConversation(currentUser.userId, agentId))
      ? "verified"
      : "unverified";
    const now = new Date();
    const [created] = await db
      .insert(agentReviews)
      .values({
        agentUserId: agentId,
        reviewerUserId: currentUser.userId,
        stars: body.stars,
        body: body.body,
        reviewType,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [agentReviews.agentUserId, agentReviews.reviewerUserId],
        set: {
          stars: body.stars,
          body: body.body,
          reviewType,
          deletedAt: null,
          updatedAt: now
        }
      })
      .returning({
        id: agentReviews.id,
        reviewType: agentReviews.reviewType
      });

    if (!created) {
      throw new Error("Review insert failed");
    }

    return jsonResponse(created, { status: 201 });
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
