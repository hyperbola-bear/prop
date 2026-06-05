import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { eq } from "drizzle-orm";
import AdminVerificationsPage from "./page";
import { db } from "../../../lib/db";
import { agentProfiles, users } from "../../../../../packages/db/schema";

vi.mock("../../../lib/server-auth", () => ({
  currentSessionUser: vi.fn(async () => ({
    id: "admin-verifications-page-test-admin",
    roles: ["admin"]
  }))
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

const touchedUserIds: string[] = [];

afterEach(async () => {
  const now = new Date();
  for (const userId of touchedUserIds.splice(0)) {
    await db
      .update(agentProfiles)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(agentProfiles.userId, userId));
    await db.update(users).set({ deletedAt: now, updatedAt: now }).where(eq(users.id, userId));
  }
});

function uniquePhone(): string {
  return `+659${Math.floor(Math.random() * 10_000_000)
    .toString()
    .padStart(7, "0")}`;
}

async function createPendingAgentForQueue(): Promise<{ id: string; name: string }> {
  const fixtureId = randomUUID();
  const [user] = await db
    .insert(users)
    .values({
      email: `admin-verifications-${fixtureId}@proppy.test`,
      name: `Pending Queue Agent ${fixtureId}`,
      phoneE164: uniquePhone(),
      phoneVerifiedAt: new Date(),
      pdpaConsentAt: new Date()
    })
    .returning({ id: users.id, name: users.name });

  if (!user) {
    throw new Error("Test user insert failed");
  }

  touchedUserIds.push(user.id);
  await db.insert(agentProfiles).values({
    userId: user.id,
    ceaRegistrationNo: `PENDING-${fixtureId.slice(0, 8)}`,
    ceaStatus: "pending",
    verifiedAt: null
  });

  return user;
}

describe("Admin verifications page", () => {
  it("removes a rejected agent from the pending verifications queue after refetch", async () => {
    const agent = await createPendingAgentForQueue();

    const initialHtml = renderToStaticMarkup(await AdminVerificationsPage());
    expect(initialHtml).toContain("admin-verifications-queue");
    expect(initialHtml).toContain(agent.name);

    await db
      .update(agentProfiles)
      .set({ ceaStatus: "rejected", verifiedAt: null, updatedAt: new Date() })
      .where(eq(agentProfiles.userId, agent.id));

    const afterRejectHtml = renderToStaticMarkup(await AdminVerificationsPage());
    expect(afterRejectHtml).toContain("admin-verifications-queue");
    expect(afterRejectHtml).not.toContain(agent.name);
  });
});
