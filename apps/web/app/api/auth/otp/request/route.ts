import { NextRequest } from "next/server";
import { requestOtp } from "../../../../../../../packages/shared/src/otp";
import { otpRequestSchema } from "../../../../../../../packages/shared/src/schemas";
import {
  checkRateLimit,
  clientIp,
  otpRequestRateLimits
} from "../../../../../lib/rate-limit";
import { jsonError, jsonResponse, mapError, optionsResponse } from "../../../../../lib/route-helpers";

export async function POST(request: NextRequest) {
  try {
    const body = otpRequestSchema.parse(await request.json());
    const identifier = `${body.phone}+${clientIp(request.headers)}`;
    const rateLimit = checkRateLimit(identifier, otpRequestRateLimits);
    if (!rateLimit.ok) {
      return jsonError(429, "rate_limited", "Try again later", undefined, {
        "Retry-After": String(rateLimit.retryAfterSec)
      });
    }

    const response = await requestOtp(body.phone);
    return jsonResponse(response);
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
