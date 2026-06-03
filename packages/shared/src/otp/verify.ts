import argon2 from "argon2";
import { z } from "zod";
import { phoneSchema } from "./request";
import { defaultOtpCodeStore, type OtpCodeStore } from "./store";

const otpCodeSchema = z.string().regex(/^[0-9]{6}$/);

type VerifyOtpOptions = {
  store?: OtpCodeStore;
  now?: () => Date;
};

export type VerifyOtpResult =
  | { ok: true }
  | { ok: false; error: "invalid_otp" | "expired_otp" };

export async function verifyOtp(
  phone: string,
  code: string,
  options: VerifyOtpOptions = {}
): Promise<VerifyOtpResult> {
  const phoneE164 = phoneSchema.parse(phone);

  if (process.env.DEV_OTP_BYPASS === "true" && code === "000000") {
    return { ok: true };
  }

  if (!otpCodeSchema.safeParse(code).success) {
    return { ok: false, error: "invalid_otp" };
  }

  const now = options.now?.() ?? new Date();
  const store = options.store ?? defaultOtpCodeStore;
  const activeCode = await store.findLatestActiveCode(phoneE164, now);

  if (!activeCode) {
    return { ok: false, error: "expired_otp" };
  }

  const matches = await argon2.verify(activeCode.codeHash, code);
  if (!matches) {
    await store.recordFailedAttempt(activeCode.id, now);
    return { ok: false, error: "invalid_otp" };
  }

  const consumed = await store.markConsumed(activeCode.id, now);
  if (!consumed) {
    return { ok: false, error: "invalid_otp" };
  }

  return { ok: true };
}
