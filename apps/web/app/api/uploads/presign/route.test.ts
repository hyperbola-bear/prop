import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { POST } from "./route";
import { signSessionToken } from "../../../../lib/auth-context";
import { db } from "../../../../lib/db";
import { uploadSessions, users } from "../../../../../../packages/db/schema";

async function tokenFor(email: string): Promise<string> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) throw new Error(`Missing seed user ${email}`);
  return signSessionToken(user.id, []);
}

function jsonRequest(token: string | null, body: unknown) {
  return new NextRequest("http://localhost:3100/api/uploads/presign", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
}

describe("POST /api/uploads/presign", () => {
  it("returns a MinIO-hosted upload URL, fields, and key", async () => {
    const token = await tokenFor("landlord1@proppy.test");
    const response = await POST(
      jsonRequest(token, { contentType: "image/jpeg", scope: "listing-photo" })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        url: expect.any(String),
        fields: expect.any(Object),
        key: expect.stringMatching(/^listing-photo\/.+\.jpg$/)
      })
    );
    expect(new URL(body.url).host).toBe("localhost:9000");

    const [session] = await db
      .select({ uploadObjectPath: uploadSessions.s3Key })
      .from(uploadSessions)
      .where(eq(uploadSessions.s3Key, body.key));
    expect(session?.uploadObjectPath).toBe(body.key);
  });

  it("requires auth and validates content type", async () => {
    const unauthenticated = await POST(
      jsonRequest(null, { contentType: "image/jpeg", scope: "listing-photo" })
    );
    expect(unauthenticated.status).toBe(401);

    const token = await tokenFor("landlord1@proppy.test");
    const invalid = await POST(
      jsonRequest(token, { contentType: "text/html", scope: "listing-photo" })
    );
    expect(invalid.status).toBe(400);
  });
});
