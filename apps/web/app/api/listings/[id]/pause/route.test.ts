import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { POST as pauseListing } from "./route";
import { POST as refreshListing } from "../refresh/route";
import { POST as markRentedListing } from "../mark-rented/route";
import { POST as delistListing } from "../delist/route";
import { signSessionToken } from "../../../../../lib/auth-context";
import { db } from "../../../../../lib/db";
import { listingEvents, listings, users } from "../../../../../../../packages/db/schema";

async function seededUser(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) throw new Error(`Missing seed user ${email}`);
  return user;
}

async function tokenFor(email: string): Promise<string> {
  const user = await seededUser(email);
  return signSessionToken(user.id, []);
}

async function createListing(ownerEmail = "landlord1@proppy.test") {
  const owner = await seededUser(ownerEmail);
  const [created] = await db
    .insert(listings)
    .values({
      ownerUserId: owner.id,
      status: "published",
      listingType: "rental",
      propertyType: "hdb",
      representedVia: "owner",
      title: `Lifecycle listing ${Date.now()} ${Math.random()}`,
      priceSgd: 300000n
    })
    .returning({ id: listings.id });
  return created!.id;
}

function request(path: string, token: string) {
  return new NextRequest(`http://localhost:3100${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` }
  });
}

async function eventExists(listingId: string, eventType: string) {
  const [event] = await db
    .select({ id: listingEvents.id })
    .from(listingEvents)
    .where(and(eq(listingEvents.listingId, listingId), eq(listingEvents.eventType, eventType)))
    .limit(1);
  return Boolean(event);
}

describe("listing lifecycle action routes", () => {
  it("pauses, refreshes, marks rented, and delists with events/timestamps", async () => {
    const token = await tokenFor("landlord1@proppy.test");

    const pausedId = await createListing();
    const pauseResponse = await pauseListing(request(`/api/listings/${pausedId}/pause`, token), {
      params: Promise.resolve({ id: pausedId })
    });
    expect(pauseResponse.status).toBe(200);
    expect(await eventExists(pausedId, "paused")).toBe(true);

    const refreshedId = await createListing();
    const refreshResponse = await refreshListing(
      request(`/api/listings/${refreshedId}/refresh`, token),
      { params: Promise.resolve({ id: refreshedId }) }
    );
    expect(refreshResponse.status).toBe(200);
    expect(await eventExists(refreshedId, "refreshed")).toBe(true);

    const rentedId = await createListing();
    const rentedResponse = await markRentedListing(
      request(`/api/listings/${rentedId}/mark-rented`, token),
      { params: Promise.resolve({ id: rentedId }) }
    );
    expect(rentedResponse.status).toBe(200);

    const delistedId = await createListing();
    const delistedResponse = await delistListing(
      request(`/api/listings/${delistedId}/delist`, token),
      { params: Promise.resolve({ id: delistedId }) }
    );
    expect(delistedResponse.status).toBe(200);

    const rows = await db
      .select({
        id: listings.id,
        status: listings.status,
        refreshedAt: listings.refreshedAt,
        rentedAt: listings.rentedAt,
        delistedAt: listings.delistedAt
      })
      .from(listings)
      .where(eq(listings.ownerUserId, (await seededUser("landlord1@proppy.test")).id));
    expect(rows.find((row) => row.id === pausedId)?.status).toBe("paused");
    expect(rows.find((row) => row.id === refreshedId)?.status).toBe("published");
    expect(rows.find((row) => row.id === refreshedId)?.refreshedAt).toBeInstanceOf(Date);
    expect(rows.find((row) => row.id === rentedId)?.rentedAt).toBeInstanceOf(Date);
    expect(rows.find((row) => row.id === delistedId)?.delistedAt).toBeInstanceOf(Date);
    expect(await eventExists(rentedId, "rented")).toBe(true);
    expect(await eventExists(delistedId, "delisted")).toBe(true);
  });

  it("refreshes a paused listing without changing its status", async () => {
    const token = await tokenFor("landlord1@proppy.test");
    const listingId = await createListing();

    await db.update(listings).set({ status: "paused" }).where(eq(listings.id, listingId));

    const response = await refreshListing(request(`/api/listings/${listingId}/refresh`, token), {
      params: Promise.resolve({ id: listingId })
    });

    expect(response.status).toBe(200);
    const [row] = await db
      .select({ status: listings.status, refreshedAt: listings.refreshedAt })
      .from(listings)
      .where(eq(listings.id, listingId));
    expect(row?.status).toBe("paused");
    expect(row?.refreshedAt).toBeInstanceOf(Date);
    expect(await eventExists(listingId, "refreshed")).toBe(true);
  });
});
