import { and, eq, isNull } from "drizzle-orm";
import {
  listingEvents,
  listings,
  type ListingStatus
} from "../../../packages/db/schema";
import { db } from "./db";
import { ForbiddenError, NotFoundError, type CurrentUser } from "./route-helpers";

export type MutableListing = {
  id: string;
  ownerUserId: string;
  agentUserId: string | null;
  representedVia: string;
};

export function canMutateListing(listing: MutableListing, currentUser: CurrentUser): boolean {
  return (
    listing.ownerUserId === currentUser.userId ||
    (listing.agentUserId === currentUser.userId &&
      ["agent_mandate", "agent_no_mandate"].includes(listing.representedVia))
  );
}

export async function requireListingMutationAccess(
  listingId: string,
  currentUser: CurrentUser
): Promise<MutableListing> {
  const [listing] = await db
    .select({
      id: listings.id,
      ownerUserId: listings.ownerUserId,
      agentUserId: listings.agentUserId,
      representedVia: listings.representedVia
    })
    .from(listings)
    .where(and(eq(listings.id, listingId), isNull(listings.deletedAt)))
    .limit(1);

  if (!listing) {
    throw new NotFoundError("Listing not found");
  }

  if (!canMutateListing(listing, currentUser)) {
    throw new ForbiddenError("Not the listing owner or assigned agent");
  }

  return listing;
}

export async function insertListingEvent(
  listingId: string,
  actorUserId: string,
  eventType: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await db.insert(listingEvents).values({
    listingId,
    actorUserId,
    eventType,
    metadata
  });
}

export async function setListingStatus(
  listingId: string,
  actorUserId: string,
  status: ListingStatus | null,
  timestampColumn:
    | "publishedAt"
    | "refreshedAt"
    | "rentedAt"
    | "delistedAt"
    | "expiresAt"
    | null,
  eventType: string
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(listings)
      .set({
        ...(status ? { status } : {}),
        ...(timestampColumn ? { [timestampColumn]: now } : {}),
        updatedAt: now
      })
      .where(eq(listings.id, listingId));
    await tx.insert(listingEvents).values({
      listingId,
      actorUserId,
      eventType
    });
  });
}
