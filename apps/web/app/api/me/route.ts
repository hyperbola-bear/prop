import { NextRequest } from "next/server";
import { userById } from "../../../lib/auth-service";
import { requireAuth, jsonResponse, mapError, optionsResponse } from "../../../lib/route-helpers";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireAuth(request);
    const user = await userById(currentUser.userId);
    if (!user) {
      return jsonResponse(
        { error: { code: "unauthorized", message: "Authentication required" } },
        { status: 401 }
      );
    }

    return jsonResponse({
      email: user.email,
      name: user.name,
      phone: user.phone,
      roles: user.roles
    });
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
