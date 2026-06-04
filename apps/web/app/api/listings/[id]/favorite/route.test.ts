import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { DELETE, POST } from "./route";
import { GET as GET_FAVORITES } from "../../../me/favorites/route";
import { signSessionToken } from "../../../../../lib/auth-context";
import { db } from "../../../../../lib/db";
import { favorites, listings, users } from "../../../../../../../packages/db/schema";

async function tokenFor(email: string): Promise<string> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) throw new Error(`Missing seed user ${email}`);
  return signSessionToken(user.id, []);
}

async function publicListingId(): Promise<string> {
  const [row] = await db
    .select({ id: listings.id })
    .from(listings)
    .where(eq(listings.status, "published"))
    .limit(1);
  if (!row) throw new Error("Missing seeded public listing");
  return row.id;
}

function request(path: string, method: string, token: string | null) {
  return new NextRequest(`http://localhost:3100${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {})
    }
  });
}

describe("favorites API", () => {
  it("idempotently favorites, lists, and soft-removes a listing", async () => {
    const token = await tokenFor("renter2@proppy.test");
    const listingId = await publicListingId();
    const context = { params: Promise.resolve({ id: listingId }) };

    const first = await POST(
      request(`/api/listings/${listingId}/favorite`, "POST", token),
      context
    );
    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toEqual({ ok: true });

    const second = await POST(
      request(`/api/listings/${listingId}/favorite`, "POST", token),
      context
    );
    expect(second.status).toBe(200);

    const rows = await db
      .select({ id: favorites.id, deletedAt: favorites.deletedAt })
      .from(favorites)
      .innerJoin(users, eq(users.id, favorites.userId))
      .where(
        and(
          eq(users.email, "renter2@proppy.test"),
          eq(favorites.listingId, listingId),
          isNull(favorites.deletedAt)
        )
      );
    expect(rows).toHaveLength(1);

    const listed = await GET_FAVORITES(request("/api/me/favorites", "GET", token));
    expect(listed.status).toBe(200);
    const body = await listed.json();
    expect(body.items.some((item: { id: string }) => item.id === listingId)).toBe(true);

    const deleted = await DELETE(
      request(`/api/listings/${listingId}/favorite`, "DELETE", token),
      context
    );
    expect(deleted.status).toBe(204);

    const activeRows = await db
      .select({ id: favorites.id })
      .from(favorites)
      .innerJoin(users, eq(users.id, favorites.userId))
      .where(
        and(
          eq(users.email, "renter2@proppy.test"),
          eq(favorites.listingId, listingId),
          isNull(favorites.deletedAt)
        )
      );
    expect(activeRows).toHaveLength(0);
  });

  it("requires auth", async () => {
    const listingId = await publicListingId();
    const response = await POST(
      request(`/api/listings/${listingId}/favorite`, "POST", null),
      { params: Promise.resolve({ id: listingId }) }
    );
    expect(response.status).toBe(401);
  });
});
