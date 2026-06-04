import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { POST } from "./route";
import { signSessionToken } from "../../../../lib/auth-context";
import { db } from "../../../../lib/db";
import { uploadSessions, users } from "../../../../../../packages/db/schema";
import {
  MAX_UPLOAD_SIZE_BYTES,
  presignUploadSchema
} from "../../../../../../packages/shared/src/schemas";

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
  it("rejects missing, zero, and oversized fileSize values at the schema boundary", () => {
    const base = { contentType: "image/jpeg", scope: "listing-photo" };

    expect(presignUploadSchema.safeParse(base).success).toBe(false);
    expect(presignUploadSchema.safeParse({ ...base, fileSize: 0 }).success).toBe(false);
    expect(
      presignUploadSchema.safeParse({ ...base, fileSize: MAX_UPLOAD_SIZE_BYTES + 1 }).success
    ).toBe(false);
    expect(
      presignUploadSchema.safeParse({ ...base, fileSize: MAX_UPLOAD_SIZE_BYTES }).success
    ).toBe(true);
  });

  it("returns a MinIO-hosted upload URL, fields, and key", async () => {
    const token = await tokenFor("landlord1@proppy.test");
    const response = await POST(
      jsonRequest(token, { contentType: "image/jpeg", fileSize: 1024, scope: "listing-photo" })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        url: expect.any(String),
        fields: expect.any(Object),
        key: expect.stringMatching(/^listing-photo\/.+\.jpg$/),
        maxSizeBytes: MAX_UPLOAD_SIZE_BYTES,
        method: "POST"
      })
    );
    expect(new URL(body.url).host).toBe("localhost:9000");
    expect(body.fields).toEqual(
      expect.objectContaining({
        "Content-Type": "image/jpeg",
        key: body.key
      })
    );

    const [session] = await db
      .select({ uploadObjectPath: uploadSessions.s3Key })
      .from(uploadSessions)
      .where(eq(uploadSessions.s3Key, body.key));
    expect(session?.uploadObjectPath).toBe(body.key);
  });

  it("requires auth and validates content type", async () => {
    const unauthenticated = await POST(
      jsonRequest(null, { contentType: "image/jpeg", fileSize: 1024, scope: "listing-photo" })
    );
    expect(unauthenticated.status).toBe(401);

    const token = await tokenFor("landlord1@proppy.test");
    const invalid = await POST(
      jsonRequest(token, { contentType: "text/html", fileSize: 1024, scope: "listing-photo" })
    );
    expect(invalid.status).toBe(400);
  });

  it("returns file_too_large for missing, zero, and oversized request sizes", async () => {
    const token = await tokenFor("landlord1@proppy.test");
    for (const body of [
      { contentType: "image/jpeg", scope: "listing-photo" },
      { contentType: "image/jpeg", fileSize: 0, scope: "listing-photo" },
      {
        contentType: "image/jpeg",
        fileSize: MAX_UPLOAD_SIZE_BYTES + 1,
        scope: "listing-photo"
      }
    ]) {
      const response = await POST(jsonRequest(token, body));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "file_too_large",
          message: "Upload exceeds the 10MB limit"
        }
      });
    }
  });

  it("rejects an oversized actual upload through the returned presigned POST", async () => {
    const token = await tokenFor("landlord1@proppy.test");
    const response = await POST(
      jsonRequest(token, { contentType: "image/jpeg", fileSize: 1024, scope: "listing-photo" })
    );
    expect(response.status).toBe(200);
    const presign = (await response.json()) as {
      fields: Record<string, string>;
      key: string;
      method: string;
      url: string;
    };
    expect(presign.method).toBe("POST");
    expect(presign.fields.key).toBe(presign.key);
    expect(presign.fields["Content-Type"]).toBe("image/jpeg");

    const form = new FormData();
    for (const [field, value] of Object.entries(presign.fields)) {
      form.append(field, value);
    }
    form.append(
      "file",
      new Blob([new Uint8Array(MAX_UPLOAD_SIZE_BYTES + 1)], { type: "image/jpeg" }),
      "oversized.jpg"
    );

    const upload = await fetch(presign.url, { method: "POST", body: form });
    expect([400, 413]).toContain(upload.status);
  });
});
