import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@proppy/db";
import { otpCodes } from "@proppy/db";
import { getOtpDb } from "./db";

export type OtpCodeRecord = {
  id: string;
  phoneE164: string;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  attempts: number;
  createdAt: Date;
};

export type InsertOtpCodeInput = {
  phoneE164: string;
  codeHash: string;
  expiresAt: Date;
  createdAt: Date;
};

export type OtpCodeStore = {
  insertCode(input: InsertOtpCodeInput): Promise<OtpCodeRecord>;
  findLatestActiveCode(phoneE164: string, now: Date): Promise<OtpCodeRecord | null>;
  markConsumed(id: string, consumedAt: Date): Promise<void>;
  recordFailedAttempt(id: string, attemptedAt: Date): Promise<void>;
};

type OtpDatabase = PostgresJsDatabase<typeof schema>;

function toOtpCodeRecord(row: typeof otpCodes.$inferSelect): OtpCodeRecord {
  return {
    id: row.id,
    phoneE164: row.phoneE164,
    codeHash: row.codeHash,
    expiresAt: row.expiresAt,
    consumedAt: row.consumedAt,
    attempts: row.attempts,
    createdAt: row.createdAt
  };
}

export class DrizzleOtpCodeStore implements OtpCodeStore {
  constructor(private readonly getDb: () => OtpDatabase = getOtpDb) {}

  async insertCode(input: InsertOtpCodeInput): Promise<OtpCodeRecord> {
    const [row] = await this.getDb()
      .insert(otpCodes)
      .values({
        phoneE164: input.phoneE164,
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
        createdAt: input.createdAt,
        updatedAt: input.createdAt
      })
      .returning();

    if (!row) {
      throw new Error("Failed to insert OTP code");
    }

    return toOtpCodeRecord(row);
  }

  async findLatestActiveCode(phoneE164: string, now: Date): Promise<OtpCodeRecord | null> {
    const [row] = await this.getDb()
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.phoneE164, phoneE164),
          isNull(otpCodes.consumedAt),
          isNull(otpCodes.deletedAt),
          gt(otpCodes.expiresAt, now)
        )
      )
      .orderBy(desc(otpCodes.createdAt))
      .limit(1);

    return row ? toOtpCodeRecord(row) : null;
  }

  async markConsumed(id: string, consumedAt: Date): Promise<void> {
    await this.getDb()
      .update(otpCodes)
      .set({ consumedAt, updatedAt: consumedAt })
      .where(eq(otpCodes.id, id));
  }

  async recordFailedAttempt(id: string, attemptedAt: Date): Promise<void> {
    await this.getDb()
      .update(otpCodes)
      .set({
        attempts: sql`${otpCodes.attempts} + 1`,
        consumedAt: sql`CASE WHEN ${otpCodes.attempts} + 1 >= 5 THEN ${attemptedAt} ELSE ${otpCodes.consumedAt} END`,
        updatedAt: attemptedAt
      })
      .where(eq(otpCodes.id, id));
  }
}

export const defaultOtpCodeStore = new DrizzleOtpCodeStore();
