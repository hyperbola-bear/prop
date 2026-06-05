import { NextRequest } from "next/server";
import { and, count, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import {
  agentProfiles,
  agentReviews,
  enquiries,
  listings,
  users
} from "../../../../../../packages/db/schema";
import { agentProfileResponseSchema } from "../../../../../../packages/shared/src/schemas";
import { db } from "../../../../lib/db";
import { presignPhotoGetUrl } from "../../../../lib/storage";
import { jsonResponse, mapError, NotFoundError, optionsResponse } from "../../../../lib/route-helpers";

const agentIdSchema = z.uuid();

type AgentRouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

function numericOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

export async function GET(_request: NextRequest, context: AgentRouteContext) {
  try {
    const params = await context.params;
    const agentId = agentIdSchema.parse(params.id);

    const [profile] = await db
      .select({
        id: users.id,
        name: users.name,
        photoRef: agentProfiles.photoS3Key,
        bio: agentProfiles.bio,
        specialties: agentProfiles.specialties,
        languages: agentProfiles.languages,
        verifiedAt: agentProfiles.verifiedAt
      })
      .from(agentProfiles)
      .innerJoin(users, eq(users.id, agentProfiles.userId))
      .where(and(eq(agentProfiles.userId, agentId), isNull(agentProfiles.deletedAt), isNull(users.deletedAt)))
      .limit(1);

    if (!profile) {
      throw new NotFoundError("Agent not found");
    }

    const [listingCountRow] = await db
      .select({ value: count(listings.id) })
      .from(listings)
      .where(
        and(
          or(eq(listings.agentUserId, agentId), eq(listings.ownerUserId, agentId)),
          inArray(listings.status, ["published", "active"]),
          isNull(listings.deletedAt)
        )
      );

    const [stats] = await db
      .select({
        p50Minutes: sql<string | null>`percentile_cont(0.5) within group (order by extract(epoch from (${enquiries.firstResponseAt} - ${enquiries.createdAt})) / 60.0)`,
        p90Minutes: sql<string | null>`percentile_cont(0.9) within group (order by extract(epoch from (${enquiries.firstResponseAt} - ${enquiries.createdAt})) / 60.0)`
      })
      .from(enquiries)
      .innerJoin(listings, eq(listings.id, enquiries.listingId))
      .where(
        and(
          or(eq(listings.agentUserId, agentId), eq(listings.ownerUserId, agentId)),
          isNull(listings.deletedAt),
          isNull(enquiries.deletedAt),
          sql`${enquiries.firstResponseAt} is not null`
        )
      );

    const p50Minutes = numericOrNull(stats?.p50Minutes);
    const p90Minutes = numericOrNull(stats?.p90Minutes);
    const reviews = await db
      .select({
        id: agentReviews.id,
        stars: agentReviews.stars,
        body: agentReviews.body,
        reviewType: agentReviews.reviewType,
        reviewerName: users.name,
        createdAt: agentReviews.createdAt
      })
      .from(agentReviews)
      .innerJoin(users, eq(users.id, agentReviews.reviewerUserId))
      .where(and(eq(agentReviews.agentUserId, agentId), isNull(agentReviews.deletedAt), isNull(users.deletedAt)))
      .orderBy(desc(agentReviews.createdAt));

    const body = agentProfileResponseSchema.parse({
      id: profile.id,
      name: profile.name,
      photoUrl: profile.photoRef ? await presignPhotoGetUrl(profile.photoRef) : null,
      bio: profile.bio,
      specialties: profile.specialties,
      languages: profile.languages,
      listingsCount: listingCountRow?.value ?? 0,
      responseTime: {
        p50Minutes,
        p90Minutes,
        p50: p50Minutes,
        p90: p90Minutes
      },
      verified: Boolean(profile.verifiedAt),
      reviews: reviews.map((review) => ({
        ...review,
        createdAt: review.createdAt?.toISOString() ?? null
      }))
    });

    return jsonResponse(body);
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
