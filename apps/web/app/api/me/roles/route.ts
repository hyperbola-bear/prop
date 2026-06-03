import { NextRequest } from "next/server";
import { addRoleSchema } from "../../../../../../packages/shared/src/schemas";
import { addRoleForUser } from "../../../../lib/auth-service";
import {
  requireAuth,
  jsonResponse,
  jsonError,
  mapError,
  optionsResponse
} from "../../../../lib/route-helpers";

const AGENT_ROLE_ERROR_MESSAGE = "Agent role requires CEA verification via /api/agents/apply";

function requestedRole(input: unknown): unknown {
  if (!input || typeof input !== "object" || !("role" in input)) {
    return undefined;
  }

  return (input as { role?: unknown }).role;
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAuth(request);
    const input = await request.json();
    if (requestedRole(input) === "agent") {
      return jsonError(400, "role_not_self_serve", AGENT_ROLE_ERROR_MESSAGE);
    }

    const body = addRoleSchema.parse(input);
    const roles = await addRoleForUser(currentUser.userId, body.role);
    return jsonResponse({ roles });
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
