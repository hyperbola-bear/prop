import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { GET as getAgent } from "./route";
import { POST as createReview } from "./reviews/route";
import { POST as signup } from "../../auth/signup/route";
import { POST as login } from "../../auth/login/route";
import { POST as createSellerVerification } from "../../listings/[id]/seller-verifications/route";
import { POST as approveVerification } from "../../admin/verifications/[id]/approve/route";
import { POST as rejectVerification } from "../../admin/verifications/[id]/reject/route";
import { PATCH as resolveReport } from "../../admin/reports/[id]/route";
import { POST as deleteMe } from "../../me/delete/route";
import { signSessionToken } from "../../../../lib/auth-context";
import { db } from "../../../../lib/db";
import {
  agentProfiles,
  agentReviews,
  conversations,
  enquiries,
  listings,
  messages,
  reports,
  sellerPropertyVerifications,
  users
} from "../../../../../../packages/db/schema";

const touchedListingIds: string[] = [];
const touchedConversationIds: string[] = [];
const touchedReviewIds: string[] = [];
const touchedVerificationIds: string[] = [];
const touchedReportIds: string[] = [];
const touchedUserIds: string[] = [];

function jsonRequest(path: string, method: string, token: string | null, body?: unknown) {
  return new NextRequest(`http://localhost:3100${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
}

async function userByEmail(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new Error(`Missing user ${email}`);
  return user;
}

async function tokenFor(email: string): Promise<string> {
  const user = await userByEmail(email);
  return signSessionToken(user.id, []);
}

async function agentId(email = "agent1@proppy.test"): Promise<string> {
  return (await userByEmail(email)).id;
}

async function createTestListing(ownerUserId: string, agentUserId?: string | null): Promise<string> {
  const [listing] = await db
    .insert(listings)
    .values({
      ownerUserId,
      agentUserId: agentUserId ?? null,
      representedVia: agentUserId ? "agent_mandate" : "owner",
      status: "published",
      listingType: "rental",
      propertyType: "hdb",
      title: `M5 API ${randomUUID()}`,
      priceSgd: 280000n,
      priceUnit: "month",
      publishedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000)
    })
    .returning({ id: listings.id });
  if (!listing) throw new Error("Listing insert failed");
  touchedListingIds.push(listing.id);
  return listing.id;
}

afterEach(async () => {
  const now = new Date();
  for (const reviewId of touchedReviewIds.splice(0)) {
    await db.update(agentReviews).set({ deletedAt: now, updatedAt: now }).where(eq(agentReviews.id, reviewId));
  }
  for (const verificationId of touchedVerificationIds.splice(0)) {
    await db
      .update(sellerPropertyVerifications)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(sellerPropertyVerifications.id, verificationId));
  }
  for (const reportId of touchedReportIds.splice(0)) {
    await db.update(reports).set({ deletedAt: now, updatedAt: now }).where(eq(reports.id, reportId));
  }
  for (const conversationId of touchedConversationIds.splice(0)) {
    await db.update(messages).set({ deletedAt: now, updatedAt: now }).where(eq(messages.conversationId, conversationId));
    await db.update(enquiries).set({ deletedAt: now, updatedAt: now }).where(eq(enquiries.conversationId, conversationId));
    await db.update(conversations).set({ deletedAt: now, updatedAt: now }).where(eq(conversations.id, conversationId));
  }
  for (const listingId of touchedListingIds.splice(0)) {
    await db.update(listings).set({ deletedAt: now, updatedAt: now }).where(eq(listings.id, listingId));
  }
  for (const userId of touchedUserIds.splice(0)) {
    await db.update(users).set({ deletedAt: now, updatedAt: now }).where(eq(users.id, userId));
  }
});

describe("M5 agents, verification, admin, and PDPA APIs", () => {
  it("marks agent signups verified from the CEA snapshot but leaves misses pending", async () => {
    const validEmail = `valid-agent-${Date.now()}@proppy.test`;
    const validSignup = await signup(
      jsonRequest("/api/auth/signup", "POST", null, {
        email: validEmail,
        password: "Test!234",
        phone: `+65${Math.floor(10000000 + Math.random() * 89999999)}`,
        role: "agent",
        pdpaConsent: true,
        cea_no: "R012345A"
      })
    );
    expect(validSignup.status).toBe(200);
    const validBody = await validSignup.json();
    touchedUserIds.push(validBody.userId);

    const [validProfile] = await db
      .select()
      .from(agentProfiles)
      .where(eq(agentProfiles.userId, validBody.userId));
    expect(validProfile?.verifiedAt).toBeInstanceOf(Date);
    expect(validProfile?.agencyName).toBe("PropNex Realty Pte Ltd");

    const invalidEmail = `pending-agent-${Date.now()}@proppy.test`;
    const invalidSignup = await signup(
      jsonRequest("/api/auth/signup", "POST", null, {
        email: invalidEmail,
        password: "Test!234",
        phone: `+65${Math.floor(10000000 + Math.random() * 89999999)}`,
        role: "agent",
        pdpaConsent: true,
        cea_no: "XXXXXXXX"
      })
    );
    expect(invalidSignup.status).toBe(200);
    const invalidBody = await invalidSignup.json();
    touchedUserIds.push(invalidBody.userId);

    const [invalidProfile] = await db
      .select()
      .from(agentProfiles)
      .where(eq(agentProfiles.userId, invalidBody.userId));
    expect(invalidProfile?.verifiedAt).toBeNull();
    expect(invalidProfile?.agencyName).toBeNull();
  });

  it("returns agent profile stats and verified flags", async () => {
    const agent1Id = await agentId("agent1@proppy.test");
    const agent2Id = await agentId("agent2@proppy.test");
    const landlord = await userByEmail("landlord1@proppy.test");
    const renter = await userByEmail("renter1@proppy.test");
    const listingId = await createTestListing(landlord.id, agent1Id);
    const [conversation] = await db
      .insert(conversations)
      .values({
        listingId,
        buyerUserId: renter.id,
        sellerUserId: agent1Id,
        lastMessageAt: new Date()
      })
      .returning({ id: conversations.id });
    if (!conversation) throw new Error("Conversation insert failed");
    touchedConversationIds.push(conversation.id);
    await db.insert(enquiries).values({
      listingId,
      buyerUserId: renter.id,
      conversationId: conversation.id,
      createdAt: new Date(Date.now() - 20 * 60_000),
      firstResponseAt: new Date(Date.now() - 5 * 60_000)
    });

    const response = await getAgent(
      jsonRequest(`/api/agents/${agent1Id}`, "GET", null),
      { params: Promise.resolve({ id: agent1Id }) }
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      id: agent1Id,
      name: "Alicia Tan",
      specialties: expect.any(Array),
      languages: expect.any(Array),
      listingsCount: expect.any(Number),
      responseTime: {
        p50Minutes: expect.any(Number),
        p90Minutes: expect.any(Number),
        p50: expect.any(Number),
        p90: expect.any(Number)
      },
      verified: true
    });

    const agent2Response = await getAgent(
      jsonRequest(`/api/agents/${agent2Id}`, "GET", null),
      { params: Promise.resolve({ id: agent2Id }) }
    );
    expect(agent2Response.status).toBe(200);
    await expect(agent2Response.json()).resolves.toMatchObject({ verified: false });
  });

  it("creates verified and unverified reviews and rejects stars outside 1..5", async () => {
    const agent1Id = await agentId("agent1@proppy.test");
    const landlord = await userByEmail("landlord1@proppy.test");
    const renter1 = await userByEmail("renter1@proppy.test");
    const listingId = await createTestListing(landlord.id, agent1Id);
    const [conversation] = await db
      .insert(conversations)
      .values({ listingId, buyerUserId: renter1.id, sellerUserId: agent1Id, lastMessageAt: new Date() })
      .returning({ id: conversations.id });
    if (!conversation) throw new Error("Conversation insert failed");
    touchedConversationIds.push(conversation.id);
    await db.insert(messages).values([
      { conversationId: conversation.id, senderUserId: renter1.id, body: "Hello" },
      { conversationId: conversation.id, senderUserId: agent1Id, body: "Hi" }
    ]);

    const renter1Token = await tokenFor("renter1@proppy.test");
    const verified = await createReview(
      jsonRequest(`/api/agents/${agent1Id}/reviews`, "POST", renter1Token, {
        stars: 5,
        body: "Great"
      }),
      { params: Promise.resolve({ id: agent1Id }) }
    );
    expect(verified.status).toBe(201);
    const verifiedBody = await verified.json();
    touchedReviewIds.push(verifiedBody.id);
    expect(verifiedBody.reviewType).toBe("verified");

    const invalid = await createReview(
      jsonRequest(`/api/agents/${agent1Id}/reviews`, "POST", renter1Token, {
        stars: 10,
        body: "Too many stars"
      }),
      { params: Promise.resolve({ id: agent1Id }) }
    );
    expect(invalid.status).toBe(400);

    const renter2Token = await tokenFor("renter2@proppy.test");
    const unverified = await createReview(
      jsonRequest(`/api/agents/${agent1Id}/reviews`, "POST", renter2Token, {
        stars: 4,
        body: "Helpful"
      }),
      { params: Promise.resolve({ id: agent1Id }) }
    );
    expect(unverified.status).toBe(201);
    const unverifiedBody = await unverified.json();
    touchedReviewIds.push(unverifiedBody.id);
    expect(unverifiedBody.reviewType).toBe("unverified");
  });

  it("creates seller verification requests and restricts approve/reject to admins", async () => {
    const landlord = await userByEmail("landlord1@proppy.test");
    const listingId = await createTestListing(landlord.id);
    const landlordToken = await tokenFor("landlord1@proppy.test");

    const created = await createSellerVerification(
      jsonRequest(`/api/listings/${listingId}/seller-verifications`, "POST", landlordToken, {
        documentKey: "seller-verification/test/property-tax.pdf"
      }),
      { params: Promise.resolve({ id: listingId }) }
    );
    expect(created.status).toBe(201);
    const createdBody = await created.json();
    touchedVerificationIds.push(createdBody.id);
    expect(createdBody.status).toBe("pending");

    const forbidden = await approveVerification(
      jsonRequest(`/api/admin/verifications/${createdBody.id}/approve`, "POST", landlordToken),
      { params: Promise.resolve({ id: createdBody.id }) }
    );
    expect(forbidden.status).toBe(403);

    const adminToken = await tokenFor("admin@proppy.test");
    const approved = await approveVerification(
      jsonRequest(`/api/admin/verifications/${createdBody.id}/approve`, "POST", adminToken),
      { params: Promise.resolve({ id: createdBody.id }) }
    );
    expect(approved.status).toBe(200);
    await expect(approved.json()).resolves.toMatchObject({ id: createdBody.id, status: "approved" });

    const [listing] = await db.select().from(listings).where(eq(listings.id, listingId));
    expect(listing?.sellerOwnershipVerified).toBe(true);

    const rejectCreated = await createSellerVerification(
      jsonRequest(`/api/listings/${listingId}/seller-verifications`, "POST", landlordToken, {
        documentKey: "seller-verification/test/rejected.pdf"
      }),
      { params: Promise.resolve({ id: listingId }) }
    );
    const rejectBody = await rejectCreated.json();
    touchedVerificationIds.push(rejectBody.id);
    const rejected = await rejectVerification(
      jsonRequest(`/api/admin/verifications/${rejectBody.id}/reject`, "POST", adminToken),
      { params: Promise.resolve({ id: rejectBody.id }) }
    );
    expect(rejected.status).toBe(200);
    await expect(rejected.json()).resolves.toMatchObject({ status: "rejected" });
  });

  it("resolves reports as admin only", async () => {
    const renter = await userByEmail("renter1@proppy.test");
    const [report] = await db
      .insert(reports)
      .values({
        reporterUserId: renter.id,
        targetType: "listing",
        targetId: randomUUID(),
        reason: "Suspected scam",
        status: "open"
      })
      .returning({ id: reports.id });
    if (!report) throw new Error("Report insert failed");
    touchedReportIds.push(report.id);

    const renterToken = await tokenFor("renter1@proppy.test");
    const forbidden = await resolveReport(
      jsonRequest(`/api/admin/reports/${report.id}`, "PATCH", renterToken, { status: "resolved" }),
      { params: Promise.resolve({ id: report.id }) }
    );
    expect(forbidden.status).toBe(403);

    const adminToken = await tokenFor("admin@proppy.test");
    const resolved = await resolveReport(
      jsonRequest(`/api/admin/reports/${report.id}`, "PATCH", adminToken, { status: "resolved" }),
      { params: Promise.resolve({ id: report.id }) }
    );
    expect(resolved.status).toBe(200);
    await expect(resolved.json()).resolves.toMatchObject({ id: report.id, status: "resolved" });
  });

  it("soft-deletes the current user, cascades to owned listings, and blocks login", async () => {
    const email = `delete-me-${Date.now()}@proppy.test`;
    const signupResponse = await signup(
      jsonRequest("/api/auth/signup", "POST", null, {
        email,
        password: "Test!234",
        phone: `+65${Math.floor(10000000 + Math.random() * 89999999)}`,
        role: "seller",
        pdpaConsent: true
      })
    );
    expect(signupResponse.status).toBe(200);
    const { userId } = await signupResponse.json();
    touchedUserIds.push(userId);
    const listingId = await createTestListing(userId);
    const token = await signSessionToken(userId, ["seller"]);

    const response = await deleteMe(jsonRequest("/api/me/delete", "POST", token));
    expect(response.status).toBe(202);

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user?.deletedAt).toBeInstanceOf(Date);

    const [listing] = await db.select().from(listings).where(eq(listings.id, listingId));
    expect(listing?.deletedAt).toBeInstanceOf(Date);

    const activeListings = await db
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.id, listingId), isNull(listings.deletedAt)));
    expect(activeListings).toHaveLength(0);

    const loginResponse = await login(
      jsonRequest("/api/auth/login", "POST", null, { email, password: "Test!234" })
    );
    expect(loginResponse.status).toBe(401);
  });
});
