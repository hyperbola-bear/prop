import argon2 from "argon2";
import { desc, eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { otpCodes } from "@proppy/db";
import { closeOtpDb, getOtpDb } from "../db";
import { requestOtp } from "../request";
import type { OtpCodeRecord, OtpCodeStore } from "../store";
import { verifyOtp } from "../verify";

class MemoryOtpStore implements OtpCodeStore {
  readonly records: OtpCodeRecord[] = [];

  async insertCode(input: {
    phoneE164: string;
    codeHash: string;
    expiresAt: Date;
    createdAt: Date;
  }): Promise<OtpCodeRecord> {
    const record: OtpCodeRecord = {
      id: crypto.randomUUID(),
      phoneE164: input.phoneE164,
      codeHash: input.codeHash,
      expiresAt: input.expiresAt,
      attempts: 0,
      consumedAt: null,
      createdAt: input.createdAt
    };
    this.records.push(record);
    return record;
  }

  async findLatestActiveCode(phoneE164: string, now: Date): Promise<OtpCodeRecord | null> {
    return (
      this.records
        .filter(
          (record) =>
            record.phoneE164 === phoneE164 &&
            record.consumedAt === null &&
            record.expiresAt.getTime() > now.getTime()
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
    );
  }

  async markConsumed(id: string, consumedAt: Date): Promise<boolean> {
    const record = this.records.find((candidate) => candidate.id === id);
    if (record && record.consumedAt === null) {
      record.consumedAt = consumedAt;
      return true;
    }
    return false;
  }

  async recordFailedAttempt(id: string, attemptedAt: Date): Promise<void> {
    const record = this.records.find((candidate) => candidate.id === id);
    if (record) {
      record.attempts += 1;
      if (record.attempts >= 5) {
        record.consumedAt = attemptedAt;
      }
    }
  }
}

const phone = "+6581234567";
const now = new Date("2026-06-03T00:00:00.000Z");

function onlyRecord(store: MemoryOtpStore): OtpCodeRecord {
  const record = store.records[0];
  if (!record) {
    throw new Error("Expected one OTP record");
  }
  return record;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.DEV_OTP_BYPASS;
});

afterAll(async () => {
  await closeOtpDb();
});

describe("requestOtp", () => {
  it("generates a 6-digit code, stores an argon2 hash, and logs the issued code", async () => {
    const store = new MemoryOtpStore();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(
      requestOtp(phone, {
        generateCode: () => "123456",
        now: () => now,
        store
      })
    ).resolves.toEqual({ ok: true, expiresInSec: 300 });

    expect(logSpy).toHaveBeenCalledWith("OTP for +6581234567: 123456");
    const record = onlyRecord(store);
    expect(record.phoneE164).toBe(phone);
    expect(record.expiresAt.toISOString()).toBe("2026-06-03T00:05:00.000Z");
    await expect(argon2.verify(record.codeHash, "123456")).resolves.toBe(true);
  });
});

describe("verifyOtp", () => {
  it("returns ok and consumes the code when the input matches within the TTL", async () => {
    const store = new MemoryOtpStore();
    await requestOtp(phone, {
      generateCode: () => "234567",
      now: () => now,
      store
    });

    await expect(
      verifyOtp(phone, "234567", {
        now: () => new Date("2026-06-03T00:01:00.000Z"),
        store
      })
    ).resolves.toEqual({ ok: true });

    expect(onlyRecord(store).consumedAt?.toISOString()).toBe("2026-06-03T00:01:00.000Z");
  });

  it("returns invalid_otp and increments attempts when the input is wrong", async () => {
    const store = new MemoryOtpStore();
    await requestOtp(phone, {
      generateCode: () => "345678",
      now: () => now,
      store
    });

    await expect(
      verifyOtp(phone, "999999", {
        now: () => new Date("2026-06-03T00:01:00.000Z"),
        store
      })
    ).resolves.toEqual({ ok: false, error: "invalid_otp" });

    expect(onlyRecord(store).attempts).toBe(1);
  });

  it("returns expired_otp when the latest code is outside the TTL", async () => {
    const store = new MemoryOtpStore();
    await requestOtp(phone, {
      generateCode: () => "456789",
      now: () => now,
      store
    });

    await expect(
      verifyOtp(phone, "456789", {
        now: () => new Date("2026-06-03T00:05:01.000Z"),
        store
      })
    ).resolves.toEqual({ ok: false, error: "expired_otp" });
  });

  it("accepts 000000 as a universal bypass when DEV_OTP_BYPASS is true", async () => {
    process.env.DEV_OTP_BYPASS = "true";
    const store = new MemoryOtpStore();

    await expect(verifyOtp(phone, "000000", { now: () => now, store })).resolves.toEqual({
      ok: true
    });

    expect(store.records).toHaveLength(0);
  });

  it("allows exactly one concurrent real DB-backed verification to consume an OTP", async () => {
    const uniquePhone = `+659${Math.floor(1000000 + Math.random() * 8999999)}`;
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await requestOtp(uniquePhone, {
      generateCode: () => "567890"
    });

    const results = await Promise.all([
      verifyOtp(uniquePhone, "567890"),
      verifyOtp(uniquePhone, "567890")
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toHaveLength(1);

    const [row] = await getOtpDb()
      .select()
      .from(otpCodes)
      .where(eq(otpCodes.phoneE164, uniquePhone))
      .orderBy(desc(otpCodes.createdAt))
      .limit(1);

    expect(row?.consumedAt).toBeInstanceOf(Date);
  });
});
