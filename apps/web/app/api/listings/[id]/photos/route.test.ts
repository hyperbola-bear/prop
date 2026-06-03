import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { POST } from "./route";
import { PATCH as reorderPhotos } from "./reorder/route";
import { signSessionToken } from "../../../../../lib/auth-context";
import { db } from "../../../../../lib/db";
import { putStorageObject } from "../../../../../lib/storage";
import { listingPhotos, listings, users } from "../../../../../../../packages/db/schema";

async function seededUser(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) throw new Error(`Missing seed user ${email}`);
  return user;
}

async function tokenFor(email: string): Promise<string> {
  const user = await seededUser(email);
  return signSessionToken(user.id, []);
}

async function createDraft(ownerEmail = "landlord1@proppy.test") {
  const owner = await seededUser(ownerEmail);
  const [created] = await db
    .insert(listings)
    .values({
      ownerUserId: owner.id,
      status: "draft",
      listingType: "rental",
      propertyType: "hdb",
      representedVia: "owner",
      title: `Photo draft ${Date.now()} ${Math.random()}`,
      priceSgd: 300000n
    })
    .returning({ id: listings.id });
  return created!.id;
}

function photoRequest(listingId: string, token: string, body: unknown) {
  return new NextRequest(`http://localhost:3100/api/listings/${listingId}/photos`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
}

function reorderRequest(listingId: string, token: string, orderedIds: string[]) {
  return new NextRequest(`http://localhost:3100/api/listings/${listingId}/photos/reorder`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ orderedIds })
  });
}

describe("POST /api/listings/:id/photos", () => {
  it("downloads an uploaded image, processes it with sharp, and inserts listing_photos", async () => {
    const listingId = await createDraft();
    const token = await tokenFor("landlord1@proppy.test");
    const key = `tests/${listingId}/${crypto.randomUUID()}.png`;
    const image = await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 3,
        background: "#336699"
      }
    })
      .png()
      .toBuffer();
    await putStorageObject(key, image, "image/png");

    const response = await POST(
      photoRequest(listingId, token, { key, room_tag: "Living" }),
      { params: Promise.resolve({ id: listingId }) }
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({ id: expect.any(String), sortOrder: 0 });

    const [row] = await db
      .select()
      .from(listingPhotos)
      .where(eq(listingPhotos.id, body.id));
    expect(row?.s3Key).toBe(key);
    expect(row?.thumbnailS3Key).toBe(`${key}.thumb.webp`);
    expect(row?.perceptualHash).toMatch(/^[0-9a-f]{16}$/);
    expect(row?.roomTag).toBe("Living");
  });

  it("rejects callers who do not own the listing", async () => {
    const listingId = await createDraft("landlord1@proppy.test");
    const token = await tokenFor("landlord2@proppy.test");
    const response = await POST(
      photoRequest(listingId, token, { key: "tests/not-owned.png" }),
      { params: Promise.resolve({ id: listingId }) }
    );

    expect(response.status).toBe(403);
  });
});

describe("PATCH /api/listings/:id/photos/reorder", () => {
  it("updates photo sort_order in the requested order", async () => {
    const listingId = await createDraft();
    const token = await tokenFor("landlord1@proppy.test");
    const created = await db
      .insert(listingPhotos)
      .values(
        [0, 1, 2].map((index) => ({
          listingId,
          s3Key: `tests/reorder/${listingId}/${index}.jpg`,
          altText: `Photo ${index}`,
          sortOrder: index
        }))
      )
      .returning({ id: listingPhotos.id });
    const orderedIds = created.map((row) => row.id).reverse();

    const response = await reorderPhotos(reorderRequest(listingId, token, orderedIds), {
      params: Promise.resolve({ id: listingId })
    });

    expect(response.status).toBe(200);
    const rows = await db
      .select({ id: listingPhotos.id, sortOrder: listingPhotos.sortOrder })
      .from(listingPhotos)
      .where(eq(listingPhotos.listingId, listingId));
    expect(
      rows
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((row) => row.id)
    ).toEqual(orderedIds);
  });
});
