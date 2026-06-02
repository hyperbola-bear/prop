import { describe, expect, it, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "../../../lib/db";
import { users, userRoles, emailQueue } from "../../../../../packages/db/schema";
import { clearRateLimits } from "../../../lib/rate-limit";
import { POST as signup } from "./signup/route";
import { POST as requestOtp } from "./otp/request/route";
import { POST as verifyOtp } from "./otp/verify/route";
import { POST as login } from "./login/route";
import { POST as logout } from "./logout/route";
import { POST as forgotPassword } from "./password/forgot/route";
import { POST as resetPassword } from "./password/reset/route";
import { GET as me } from "../me/route";
import { POST as addRole } from "../me/roles/route";

function jsonRequest(path: string, body: unknown, headers: HeadersInit = {}) {
  return new NextRequest(`http://localhost:3100${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers
    },
    body: JSON.stringify(body)
  });
}

async function signupUniqueUser(role: "buyer" | "seller" | "agent" = "buyer") {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const phoneTail = Math.floor(10000000 + Math.random() * 89999999).toString();
  const email = `auth-${suffix}@proppy.test`;
  const phone = `+65${phoneTail}`;
  const response = await signup(
    jsonRequest("/api/auth/signup", {
      email,
      password: "Test!234",
      phone,
      role,
      pdpaConsent: true,
      cea_no: role === "agent" ? `R${phoneTail.slice(0, 6)}A` : undefined
    })
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  return { email, phone, userId: body.userId as string };
}

describe("M1 auth API routes", () => {
  beforeEach(() => {
    clearRateLimits();
  });

  it("signs up a user with argon2id password hash, PDPA timestamp, role, and unverified phone", async () => {
    const email = `signup-${Date.now()}@proppy.test`;
    const response = await signup(
      jsonRequest("/api/auth/signup", {
        email,
        password: "Test!234",
        phone: `+65${Math.floor(10000000 + Math.random() * 89999999).toString()}`,
        role: "renter",
        pdpaConsent: true
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      userId: expect.any(String),
      requiresPhoneVerification: true
    });

    const [row] = await db.select().from(users).where(eq(users.email, email));
    expect(row?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row?.pdpaConsentAt).toBeInstanceOf(Date);
    expect(row?.phoneVerifiedAt).toBeNull();

    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, row!.id));
    expect(roles.map((role) => role.role)).toContain("buyer");
  });

  it("returns fieldErrors for weak password and missing PDPA consent", async () => {
    const response = await signup(
      jsonRequest("/api/auth/signup", {
        email: `bad-${Date.now()}@proppy.test`,
        password: "abc",
        phone: "+6581222222",
        role: "buyer",
        pdpaConsent: false
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "invalid_request",
        fieldErrors: {
          password: expect.any(String),
          pdpaConsent: expect.any(String)
        }
      }
    });
  });

  it("requests OTP without exposing the code, rate limits OTP, and verifies the dev bypass", async () => {
    const { phone } = await signupUniqueUser();

    const requestResponse = await requestOtp(
      jsonRequest("/api/auth/otp/request", { phone })
    );
    expect(requestResponse.status).toBe(200);
    await expect(requestResponse.json()).resolves.toEqual({
      ok: true,
      expiresInSec: 300
    });

    for (let i = 0; i < 6; i += 1) {
      const response = await requestOtp(jsonRequest("/api/auth/otp/request", { phone }));
      if (i < 5) {
        expect(response.status).toBe(200);
      } else {
        expect(response.status).toBe(429);
      }
    }

    const verifyResponse = await verifyOtp(
      jsonRequest("/api/auth/otp/verify", { phone, code: "000000" })
    );
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.headers.get("set-cookie")).toContain("HttpOnly");
    const verifyBody = await verifyResponse.json();
    expect(verifyBody.token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    const [row] = await db.select().from(users).where(eq(users.phoneE164, phone));
    expect(row?.phoneVerifiedAt).toBeInstanceOf(Date);
  });

  it("rejects invalid OTP codes with invalid_otp", async () => {
    const { phone } = await signupUniqueUser();

    const response = await verifyOtp(
      jsonRequest("/api/auth/otp/verify", { phone, code: "123456" })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "invalid_otp" }
    });
  });

  it("logs in with a JWT and cookie, supports /api/me bearer auth, logout clears cookie, and limits bad attempts", async () => {
    const loginResponse = await login(
      jsonRequest("/api/auth/login", {
        email: "renter1@proppy.test",
        password: "Test!234"
      })
    );

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.headers.get("set-cookie")).toContain("HttpOnly");
    expect(loginResponse.headers.get("set-cookie")).toMatch(/SameSite=Lax/i);
    const { token } = await loginResponse.json();
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    const meResponse = await me(
      new NextRequest("http://localhost:3100/api/me", {
        headers: { authorization: `Bearer ${token}` }
      })
    );
    expect(meResponse.status).toBe(200);
    await expect(meResponse.json()).resolves.toMatchObject({
      email: "renter1@proppy.test",
      phone: "+6580000005",
      roles: expect.arrayContaining(["buyer"])
    });

    const meCookieResponse = await me(
      new NextRequest("http://localhost:3100/api/me", {
        headers: { cookie: `authjs.session-token=${token}` }
      })
    );
    expect(meCookieResponse.status).toBe(200);
    await expect(meCookieResponse.json()).resolves.toMatchObject({
      email: "renter1@proppy.test"
    });

    const unauthenticated = await me(new NextRequest("http://localhost:3100/api/me"));
    expect(unauthenticated.status).toBe(401);

    const logoutResponse = await logout(jsonRequest("/api/auth/logout", {}));
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.headers.get("set-cookie")).toContain("Max-Age=0");

    clearRateLimits();
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      const response = await login(
        jsonRequest("/api/auth/login", {
          email: "renter1@proppy.test",
          password: "wrong"
        })
      );
      expect(response.status).toBe(attempt === 6 ? 429 : 401);
    }
  });

  it("adds a second role for the authenticated user", async () => {
    const { userId, phone } = await signupUniqueUser();
    const verifyResponse = await verifyOtp(
      jsonRequest("/api/auth/otp/verify", { phone, code: "000000" })
    );
    const { token } = await verifyResponse.json();

    const response = await addRole(
      jsonRequest(
        "/api/me/roles",
        { role: "landlord" },
        { authorization: `Bearer ${token}` }
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      roles: expect.arrayContaining(["buyer", "seller"])
    });
    const roles = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
    expect(roles.map((role) => role.role)).toEqual(expect.arrayContaining(["buyer", "seller"]));
  });

  it("queues a password reset email and accepts a valid reset token", async () => {
    const { email } = await signupUniqueUser();
    const forgotResponse = await forgotPassword(
      jsonRequest("/api/auth/password/forgot", { email })
    );
    expect(forgotResponse.status).toBe(200);
    await expect(forgotResponse.json()).resolves.toEqual({ ok: true });

    const [queued] = await db
      .select()
      .from(emailQueue)
      .where(eq(emailQueue.toEmail, email))
      .orderBy(desc(emailQueue.createdAt))
      .limit(1);
    expect(queued?.subject).toContain("Reset");
    const token = queued!.body.match(/token=([^\s]+)/)?.[1];
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    const resetResponse = await resetPassword(
      jsonRequest("/api/auth/password/reset", {
        token,
        newPassword: "Test!2345"
      })
    );
    expect(resetResponse.status).toBe(200);
  });
});
