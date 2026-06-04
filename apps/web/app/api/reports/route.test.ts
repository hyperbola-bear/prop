import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { POST } from "./route";
import { signSessionToken } from "../../../lib/auth-context";
import { db } from "../../../lib/db";
import { reports, users } from "../../../../../packages/db/schema";

const touchedReportIds: string[] = [];

async function tokenFor(email: string): Promise<string> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error(`Missing seed user ${email}`);
  return signSessionToken(user.id, []);
}

function request(token: string | null, body: unknown) {
  return new NextRequest("http://localhost:3100/api/reports", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
}

afterEach(async () => {
  for (const reportId of touchedReportIds.splice(0)) {
    await db
      .update(reports)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(reports.id, reportId));
  }
});

describe("reports API", () => {
  it("creates open reports for the authenticated caller", async () => {
    const token = await tokenFor("renter1@proppy.test");
    const targetId = randomUUID();

    const response = await POST(
      request(token, {
        targetType: "listing",
        targetId,
        reason: "Suspected scam",
        body: "Asked for upfront deposit"
      })
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    touchedReportIds.push(body.id);
    expect(body).toMatchObject({ id: expect.any(String), status: "open" });

    const [row] = await db.select().from(reports).where(eq(reports.id, body.id));
    expect(row).toMatchObject({
      targetType: "listing",
      targetId,
      reason: "Suspected scam",
      status: "open"
    });
  });

  it("requires auth and rejects invalid target types", async () => {
    const unauthenticated = await POST(
      request(null, {
        targetType: "listing",
        targetId: randomUUID(),
        reason: "No auth"
      })
    );
    expect(unauthenticated.status).toBe(401);

    const token = await tokenFor("renter1@proppy.test");
    const invalid = await POST(
      request(token, {
        targetType: "payment",
        targetId: randomUUID(),
        reason: "Bad type"
      })
    );
    expect(invalid.status).toBe(400);
  });
});
