import { NextRequest } from "next/server";
import { signupSchema } from "../../../../../../packages/shared/src/schemas";
import { createUser } from "../../../../lib/auth-service";
import { jsonError, jsonResponse, mapError, optionsResponse } from "../../../../lib/route-helpers";

export async function POST(request: NextRequest) {
  try {
    const body = signupSchema.parse(await request.json());
    const created = await createUser({
      email: body.email,
      password: body.password,
      phone: body.phone,
      role: body.role,
      ...(body.cea_no ? { cea_no: body.cea_no } : {})
    });

    return jsonResponse({
      userId: created.userId,
      requiresPhoneVerification: true
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return jsonError(409, "user_exists", "A user with that email or phone already exists");
    }
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
