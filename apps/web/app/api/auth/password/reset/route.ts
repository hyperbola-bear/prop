import { NextRequest } from "next/server";
import { resetPasswordSchema } from "../../../../../../../packages/shared/src/schemas";
import { verifyPasswordResetToken } from "../../../../../lib/auth-context";
import { updatePassword } from "../../../../../lib/auth-service";
import { jsonError, jsonResponse, mapError, optionsResponse } from "../../../../../lib/route-helpers";

export async function POST(request: NextRequest) {
  try {
    const body = resetPasswordSchema.parse(await request.json());
    let userId: string;
    try {
      userId = await verifyPasswordResetToken(body.token);
    } catch {
      return jsonError(400, "invalid_token", "Invalid or expired reset token");
    }

    await updatePassword(userId, body.newPassword);
    return jsonResponse({ ok: true });
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
