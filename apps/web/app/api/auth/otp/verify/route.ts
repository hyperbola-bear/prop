import { NextRequest } from "next/server";
import { verifyOtp } from "../../../../../../../packages/shared/src/otp";
import { otpVerifySchema } from "../../../../../../../packages/shared/src/schemas";
import { markPhoneVerified, tokenForUser } from "../../../../../lib/auth-service";
import { setSessionCookie } from "../../../../../lib/auth-context";
import { jsonError, jsonResponse, mapError, optionsResponse } from "../../../../../lib/route-helpers";

export async function POST(request: NextRequest) {
  try {
    const body = otpVerifySchema.parse(await request.json());
    const result = await verifyOtp(body.phone, body.code);
    if (!result.ok) {
      return jsonError(400, "invalid_otp", "Invalid OTP code");
    }

    const user = await markPhoneVerified(body.phone);
    if (!user) {
      return jsonError(400, "invalid_otp", "Invalid OTP code");
    }

    const token = await tokenForUser(user);
    const response = jsonResponse({ token });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
