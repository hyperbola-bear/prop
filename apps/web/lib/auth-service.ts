import argon2 from "argon2";
import nodemailer from "nodemailer";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  agentProfiles,
  buyerProfiles,
  emailQueue,
  sellerProfiles,
  userRoles,
  users
} from "../../../packages/db/schema";
import { db } from "./db";
import { env } from "./env";
import { signPasswordResetToken, signSessionToken } from "./auth-context";
import {
  normalizeRole,
  type authRoleSchema,
  type selfServeRoleSchema
} from "../../../packages/shared/src/schemas";
import type { z } from "zod";

export type UserWithRoles = {
  id: string;
  email: string;
  name: string;
  phone: string;
  passwordHash: string | null;
  roles: string[];
};

export async function rolesForUser(userId: string): Promise<string[]> {
  const rows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(and(eq(userRoles.userId, userId), isNull(userRoles.deletedAt)));
  return rows.map((row) => row.role);
}

export async function userByEmail(email: string): Promise<UserWithRoles | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email.toLowerCase()), isNull(users.deletedAt)))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phoneE164,
    passwordHash: row.passwordHash,
    roles: await rolesForUser(row.id)
  };
}

export async function userByPhone(phone: string): Promise<UserWithRoles | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.phoneE164, phone), isNull(users.deletedAt)))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phoneE164,
    passwordHash: row.passwordHash,
    roles: await rolesForUser(row.id)
  };
}

export async function userById(userId: string): Promise<UserWithRoles | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phoneE164,
    passwordHash: row.passwordHash,
    roles: await rolesForUser(row.id)
  };
}

export async function createUser(input: {
  email: string;
  password: string;
  phone: string;
  role: z.infer<typeof authRoleSchema>;
  cea_no?: string;
  name?: string;
  myinfoPayload?: unknown;
}): Promise<{ userId: string }> {
  const role = normalizeRole(input.role);
  const now = new Date();
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const email = input.email.toLowerCase();

  const [createdUser] = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(users)
      .values({
        email,
        name: input.name?.trim() || email.split("@")[0] || email,
        phoneE164: input.phone,
        passwordHash,
        pdpaConsentAt: now,
        myinfoPayload: input.myinfoPayload,
        phoneVerifiedAt: null,
        updatedAt: now
      })
      .returning();

    if (!inserted) {
      throw new Error("Failed to create user");
    }

    await tx.insert(userRoles).values({
      userId: inserted.id,
      role,
      updatedAt: now
    });

    if (role === "buyer") {
      await tx.insert(buyerProfiles).values({ userId: inserted.id, updatedAt: now });
    }

    if (role === "seller") {
      await tx.insert(sellerProfiles).values({ userId: inserted.id, updatedAt: now });
    }

    if (role === "agent") {
      await tx.insert(agentProfiles).values({
        userId: inserted.id,
        ceaRegistrationNo: input.cea_no ?? `PENDING-${inserted.id}`,
        updatedAt: now
      });
    }

    return [inserted];
  });

  return { userId: createdUser.id };
}

export async function markPhoneVerified(phone: string): Promise<UserWithRoles | null> {
  const now = new Date();
  const [row] = await db
    .update(users)
    .set({ phoneVerifiedAt: now, updatedAt: now })
    .where(and(eq(users.phoneE164, phone), isNull(users.deletedAt)))
    .returning();

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phoneE164,
    passwordHash: row.passwordHash,
    roles: await rolesForUser(row.id)
  };
}

export async function verifyPassword(user: UserWithRoles, password: string): Promise<boolean> {
  if (!user.passwordHash) {
    return false;
  }
  return argon2.verify(user.passwordHash, password);
}

export async function tokenForUser(user: Pick<UserWithRoles, "id" | "roles">): Promise<string> {
  return signSessionToken(user.id, user.roles);
}

export async function addRoleForUser(
  userId: string,
  roleInput: z.infer<typeof selfServeRoleSchema>
): Promise<string[]> {
  const role = normalizeRole(roleInput);
  const now = new Date();
  await db
    .insert(userRoles)
    .values({ userId, role, updatedAt: now })
    .onConflictDoNothing({
      target: [userRoles.userId, userRoles.role]
    });

  if (role === "buyer") {
    await db
      .insert(buyerProfiles)
      .values({ userId, updatedAt: now })
      .onConflictDoNothing();
  }
  if (role === "seller") {
    await db
      .insert(sellerProfiles)
      .values({ userId, updatedAt: now })
      .onConflictDoNothing();
  }

  return rolesForUser(userId);
}

export async function enqueuePasswordReset(email: string): Promise<void> {
  const user = await userByEmail(email);
  if (!user) {
    return;
  }

  const token = await signPasswordResetToken(user.id);
  const resetUrl = `http://localhost:3100/reset-password?token=${token}`;
  const body = `Reset your Proppy password using this URL: ${resetUrl}`;
  const [queued] = await db
    .insert(emailQueue)
    .values({
      toEmail: user.email,
      subject: "Reset your Proppy password",
      body
    })
    .returning();

  if (!queued) {
    throw new Error("Failed to enqueue password reset email");
  }

  try {
    const transport = nodemailer.createTransport({
      host: env("SMTP_HOST", "localhost"),
      port: Number(env("SMTP_PORT", "1025"))
    });
    await transport.sendMail({
      from: env("SMTP_FROM", "no-reply@proppy.test"),
      to: user.email,
      subject: "Reset your Proppy password",
      text: body
    });
    transport.close();
    await db
      .update(emailQueue)
      .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
      .where(eq(emailQueue.id, queued.id));
  } catch (error) {
    await db
      .update(emailQueue)
      .set({
        status: "pending",
        attempts: 1,
        lastError: error instanceof Error ? error.message : "Unknown email error",
        updatedAt: new Date()
      })
      .where(eq(emailQueue.id, queued.id));
  }
}

export async function updatePassword(userId: string, newPassword: string): Promise<void> {
  const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.deletedAt)));
}

export async function latestResetEmail(email: string) {
  const [queued] = await db
    .select()
    .from(emailQueue)
    .where(eq(emailQueue.toEmail, email))
    .orderBy(desc(emailQueue.createdAt))
    .limit(1);
  return queued ?? null;
}
