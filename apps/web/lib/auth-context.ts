import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { eq, isNull, and } from "drizzle-orm";
import { db } from "./db";
import { env } from "./env";
import { userRoles, users } from "../../../packages/db/schema";

export const SESSION_COOKIE_NAME = "authjs.session-token";
export const LEGACY_SESSION_COOKIE_NAME = "next-auth.session-token";

export type AuthTokenPayload = {
  sub: string;
  roles: string[];
  purpose?: "session" | "pwd-reset";
};

export type CurrentUser = {
  userId: string;
  roles: string[];
};

function jwtSecret(): Uint8Array {
  return new TextEncoder().encode(env("JWT_SECRET", "dev-jwt-secret"));
}

export async function signSessionToken(userId: string, roles: string[]): Promise<string> {
  return new SignJWT({ roles, purpose: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(jwtSecret());
}

export async function signPasswordResetToken(userId: string): Promise<string> {
  return new SignJWT({ purpose: "pwd-reset" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(jwtSecret());
}

export async function verifyAuthToken(token: string): Promise<AuthTokenPayload> {
  const { payload } = await jwtVerify(token, jwtSecret());
  const subject = payload.sub;
  if (!subject) {
    throw new Error("JWT subject is required");
  }
  return {
    sub: subject,
    roles: Array.isArray(payload.roles)
      ? payload.roles.filter((role): role is string => typeof role === "string")
      : [],
    purpose: payload.purpose === "pwd-reset" ? "pwd-reset" : "session"
  };
}

export async function verifyPasswordResetToken(token: string): Promise<string> {
  const payload = await verifyAuthToken(token);
  if (payload.purpose !== "pwd-reset") {
    throw new Error("Invalid reset token purpose");
  }
  return payload.sub;
}

async function rolesForUser(userId: string): Promise<string[]> {
  const rows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), isNull(userRoles.deletedAt)));
  return rows.map((row) => row.role);
}

async function activeUserExists(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
  return Boolean(row);
}

function bearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }
  return authorization.slice("Bearer ".length).trim();
}

function cookieToken(request: NextRequest): string | null {
  return (
    request.cookies.get(SESSION_COOKIE_NAME)?.value ??
    request.cookies.get(LEGACY_SESSION_COOKIE_NAME)?.value ??
    null
  );
}

export async function getCurrentUser(request: NextRequest): Promise<CurrentUser | null> {
  const cookie = cookieToken(request);
  if (cookie) {
    const currentUser = await currentUserFromToken(cookie);
    if (currentUser) {
      return currentUser;
    }
  }

  const bearer = bearerToken(request);
  if (!bearer) {
    return null;
  }

  return currentUserFromToken(bearer);
}

async function currentUserFromToken(token: string): Promise<CurrentUser | null> {
  if (!token) {
    return null;
  }

  try {
    const payload = await verifyAuthToken(token);
    if (payload.purpose !== "session" || !(await activeUserExists(payload.sub))) {
      return null;
    }

    const dbRoles = await rolesForUser(payload.sub);
    return {
      userId: payload.sub,
      roles: dbRoles.length > 0 ? dbRoles : payload.roles
    };
  } catch {
    return null;
  }
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24
  });
}

export function clearSessionCookie(response: NextResponse): void {
  for (const name of [SESSION_COOKIE_NAME, LEGACY_SESSION_COOKIE_NAME]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0
    });
  }
}
