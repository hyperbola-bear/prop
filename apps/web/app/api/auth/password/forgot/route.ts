import { NextRequest } from "next/server";
import { forgotPasswordSchema } from "../../../../../../../packages/shared/src/schemas";
import { enqueuePasswordReset } from "../../../../../lib/auth-service";
import { jsonResponse, mapError, optionsResponse } from "../../../../../lib/route-helpers";

export async function POST(request: NextRequest) {
  try {
    const body = forgotPasswordSchema.parse(await request.json());
    await enqueuePasswordReset(body.email);
    return jsonResponse({ ok: true });
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
