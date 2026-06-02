import { NextRequest } from "next/server";
import { addRoleSchema } from "../../../../../../packages/shared/src/schemas";
import { addRoleForUser } from "../../../../lib/auth-service";
import { requireAuth, jsonResponse, mapError, optionsResponse } from "../../../../lib/route-helpers";

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAuth(request);
    const body = addRoleSchema.parse(await request.json());
    const roles = await addRoleForUser(currentUser.userId, body.role);
    return jsonResponse({ roles });
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
