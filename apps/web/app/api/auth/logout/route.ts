import { NextRequest } from "next/server";
import { clearSessionCookie } from "../../../../lib/auth-context";
import { jsonResponse, optionsResponse } from "../../../../lib/route-helpers";

export async function POST(_request: NextRequest) {
  const response = jsonResponse({ ok: true });
  clearSessionCookie(response);
  return response;
}

export function OPTIONS() {
  return optionsResponse();
}
