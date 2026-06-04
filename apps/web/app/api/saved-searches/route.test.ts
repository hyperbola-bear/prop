import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { DELETE, PATCH } from "./[id]/route";
import { GET, POST } from "./route";
import { signSessionToken } from "../../../lib/auth-context";
import { db } from "../../../lib/db";
import { savedSearches, users } from "../../../../../packages/db/schema";

async function tokenFor(email: string): Promise<string> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) throw new Error(`Missing seed user ${email}`);
  return signSessionToken(user.id, []);
}

function request(path: string, method: string, token: string | null, body?: unknown) {
  const headers = {
    ...(body !== undefined ? { "content-type": "application/json" } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {})
  };
  if (body !== undefined) {
    return new NextRequest(`http://localhost:3100${path}`, {
      method,
      headers,
      body: JSON.stringify(body)
    });
  }
  return new NextRequest(`http://localhost:3100${path}`, { method, headers });
}

describe("saved searches API", () => {
  it("creates, lists, and soft-deletes saved searches for the current user", async () => {
    const token = await tokenFor("renter1@proppy.test");
    const name = `Tampines 4-room ${Date.now()}`;

    const createdResponse = await POST(
      request("/api/saved-searches", "POST", token, {
        name,
        query: { town: "TAMPINES", flat_type: "4-room" },
        notify_email: false
      })
    );
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json();
    expect(created).toMatchObject({
      id: expect.any(String),
      name,
      query: { town: "TAMPINES", flat_type: "4-room" },
      notify_email: false
    });

    const listedResponse = await GET(request("/api/saved-searches", "GET", token));
    expect(listedResponse.status).toBe(200);
    const listed = await listedResponse.json();
    expect(listed.items.some((item: { id: string }) => item.id === created.id)).toBe(true);

    const deletedResponse = await DELETE(
      request(`/api/saved-searches/${created.id}`, "DELETE", token),
      { params: Promise.resolve({ id: created.id }) }
    );
    expect(deletedResponse.status).toBe(204);

    const [row] = await db
      .select({ deletedAt: savedSearches.deletedAt })
      .from(savedSearches)
      .where(eq(savedSearches.id, created.id));
    expect(row?.deletedAt).toBeInstanceOf(Date);

    const activeRows = await db
      .select({ id: savedSearches.id })
      .from(savedSearches)
      .where(
        and(
          eq(savedSearches.id, created.id),
          eq(savedSearches.userId, created.user_id),
          isNull(savedSearches.deletedAt)
        )
      );
    expect(activeRows).toHaveLength(0);
  });

  it("requires auth and validates the saved query payload", async () => {
    const unauthenticated = await POST(
      request("/api/saved-searches", "POST", null, {
        name: "No auth",
        query: { town: "TAMPINES" }
      })
    );
    expect(unauthenticated.status).toBe(401);

    const token = await tokenFor("renter1@proppy.test");
    const invalid = await POST(
      request("/api/saved-searches", "POST", token, {
        name: "",
        query: { sort: "not-a-sort" }
      })
    );
    expect(invalid.status).toBe(400);
  });

  it("updates the notify-email preference for a saved search", async () => {
    const token = await tokenFor("renter1@proppy.test");
    const name = `Notify toggle ${Date.now()}`;
    const createdResponse = await POST(
      request("/api/saved-searches", "POST", token, {
        name,
        query: { town: "TAMPINES" },
        notify_email: true
      })
    );
    expect(createdResponse.status).toBe(201);
    const created = await createdResponse.json();

    const patchedResponse = await PATCH(
      request(`/api/saved-searches/${created.id}`, "PATCH", token, {
        notify_email: false
      }),
      { params: Promise.resolve({ id: created.id }) }
    );
    expect(patchedResponse.status).toBe(200);
    await expect(patchedResponse.json()).resolves.toMatchObject({
      id: created.id,
      notify_email: false
    });
  });
});
