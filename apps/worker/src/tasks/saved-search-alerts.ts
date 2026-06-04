import { and, asc, eq, gt, isNull, lte, sql } from "drizzle-orm";
import {
  addresses,
  emailQueue,
  listingHdb,
  listingRental,
  listings,
  savedSearches,
  users
} from "@proppy/db/schema";
import { db } from "../db";
import { startTicker, type StopTask } from "../ticker";
import {
  buildPublicListingConditions,
  savedSearchQueryToListingFilters
} from "../../../../packages/shared/src/search-query";
import { drainEmailQueue } from "./email";

type SavedSearchAlertsOptions = {
  intervalMs: number;
  runOnStart?: boolean;
  drainAfterQueue?: boolean;
};

type ListingMatch = {
  id: string;
  title: string;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function listingUrl(listingId: string): string {
  return `http://localhost:3100/listings/${listingId}`;
}

function emailBody(searchName: string, matches: ListingMatch[]): string {
  const plural = matches.length === 1 ? "listing" : "listings";
  return [
    `${matches.length} new ${plural} matched your saved search "${searchName}":`,
    "",
    ...matches.map((match) => `- ${match.title}: ${listingUrl(match.id)}`)
  ].join("\n");
}

export async function runSavedSearchAlerts({
  drainAfterQueue = true
}: {
  drainAfterQueue?: boolean;
} = {}): Promise<number> {
  const queued = await db.transaction(async (tx) => {
    const runAt = new Date();

    const searches = await tx
      .select({
        id: savedSearches.id,
        name: savedSearches.name,
        query: savedSearches.query,
        lastRunAt: savedSearches.lastRunAt,
        email: users.email
      })
      .from(savedSearches)
      .innerJoin(users, eq(users.id, savedSearches.userId))
      .where(
        and(
          eq(savedSearches.notifyEmail, true),
          isNull(savedSearches.deletedAt),
          isNull(users.deletedAt)
        )
      )
      .orderBy(asc(savedSearches.lastRunAt), asc(savedSearches.id))
      .for("update", { of: savedSearches, skipLocked: true });

    if (searches.length === 0) {
      console.log("[worker] saved-search-alerts: no searches to run");
      return 0;
    }

    let queued = 0;

    for (const search of searches) {
      try {
        const filters = savedSearchQueryToListingFilters(search.query);
        const newerThanLastRun = search.lastRunAt
          ? gt(listings.publishedAt, search.lastRunAt)
          : sql`${listings.publishedAt} > '-infinity'::timestamptz`;

        const matches = await tx
          .select({
            id: listings.id,
            title: listings.title
          })
          .from(listings)
          .innerJoin(addresses, eq(listings.addressId, addresses.id))
          .innerJoin(listingRental, eq(listingRental.listingId, listings.id))
          .innerJoin(listingHdb, eq(listingHdb.listingId, listings.id))
          .where(
            and(
              ...buildPublicListingConditions(filters),
              newerThanLastRun,
              lte(listings.publishedAt, runAt)
            )
          )
          .orderBy(asc(listings.publishedAt), asc(listings.id));

        if (matches.length > 0) {
          await tx.insert(emailQueue).values({
            toEmail: search.email,
            subject: `New match: ${search.name}`,
            body: emailBody(search.name, matches)
          });
          queued += 1;
          console.log(
            `[worker] saved-search-alerts: queued ${matches.length} matches for ${search.email}`
          );
        }

        await tx
          .update(savedSearches)
          .set({
            lastRunAt: runAt,
            updatedAt: runAt
          })
          .where(eq(savedSearches.id, search.id));
      } catch (error) {
        console.error(
          `[worker] saved-search-alerts: failed saved search ${search.id}: ${errorMessage(error)}`
        );
        await tx
          .update(savedSearches)
          .set({
            lastRunAt: runAt,
            updatedAt: runAt
          })
          .where(eq(savedSearches.id, search.id));
      }
    }

    return queued;
  });

  if (queued > 0 && drainAfterQueue) {
    const sent = await drainEmailQueue();
    console.log(`[worker] saved-search-alerts: post-alert email drain sent ${sent}`);
  }

  return queued;
}

export function startSavedSearchAlerts({
  intervalMs,
  runOnStart = true,
  drainAfterQueue = true
}: SavedSearchAlertsOptions): StopTask {
  console.log(`[worker] saved-search-alerts: starting tick every ${intervalMs}ms`);
  return startTicker({
    name: "saved-search-alerts",
    intervalMs,
    runOnStart,
    run: async () => {
      const queued = await runSavedSearchAlerts({ drainAfterQueue });
      console.log(`[worker] saved-search-alerts: tick complete; queued ${queued}`);
    }
  });
}
