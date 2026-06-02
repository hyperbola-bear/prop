import { randomInt } from "node:crypto";
import argon2 from "argon2";
import { z } from "zod";
import { defaultOtpCodeStore, type OtpCodeStore } from "./store";

export const OTP_TTL_SECONDS = 300;

export const phoneSchema = z.string().regex(/^\+65[0-9]{8}$/, {
  message: "Phone number must be a Singapore E.164 number"
});

type RequestOtpOptions = {
  store?: OtpCodeStore;
  now?: () => Date;
  generateCode?: () => string;
};

export type RequestOtpResult = {
  ok: true;
  expiresInSec: typeof OTP_TTL_SECONDS;
};

function generateSixDigitCode(): string {
  return randomInt(100000, 1000000).toString();
}

export async function requestOtp(
  phone: string,
  options: RequestOtpOptions = {}
): Promise<RequestOtpResult> {
  const phoneE164 = phoneSchema.parse(phone);
  const now = options.now?.() ?? new Date();
  const code = options.generateCode?.() ?? generateSixDigitCode();

  if (!/^[0-9]{6}$/.test(code)) {
    throw new Error("Generated OTP code must be exactly 6 digits");
  }

  console.log(`OTP for ${phoneE164}: ${code}`);

  const codeHash = await argon2.hash(code, { type: argon2.argon2id });
  const expiresAt = new Date(now.getTime() + OTP_TTL_SECONDS * 1000);
  await (options.store ?? defaultOtpCodeStore).insertCode({
    phoneE164,
    codeHash,
    expiresAt,
    createdAt: now
  });

  return { ok: true, expiresInSec: OTP_TTL_SECONDS };
}
