import { NextRequest } from "next/server";
import { loginSchema } from "../../../../../../packages/shared/src/schemas";
import { tokenForUser, userByEmail, verifyPassword } from "../../../../lib/auth-service";
import { setSessionCookie } from "../../../../lib/auth-context";
import { checkRateLimit, clientIp, loginRateLimits } from "../../../../lib/rate-limit";
import { jsonError, jsonResponse, mapError, optionsResponse } from "../../../../lib/route-helpers";

function invalidCredentials() {
  return jsonError(401, "invalid_credentials", "Invalid email or password");
}

export async function POST(request: NextRequest) {
  try {
    const body = loginSchema.parse(await request.json());
    const identifier = `${body.email.toLowerCase()}+${clientIp(request.headers)}`;
    const rateLimit = checkRateLimit(identifier, loginRateLimits);
    if (!rateLimit.ok) {
      return jsonError(429, "rate_limited", "Try again later", undefined, {
        "Retry-After": String(rateLimit.retryAfterSec)
      });
    }

    const user = await userByEmail(body.email);
    if (!user || !(await verifyPassword(user, body.password))) {
      return invalidCredentials();
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
