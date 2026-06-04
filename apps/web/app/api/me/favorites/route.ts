import { NextRequest } from "next/server";
import { favoritesResponseSchema } from "../../../../../../packages/shared/src/schemas";
import { getFavoriteListings } from "../../../../lib/listings";
import { jsonResponse, mapError, optionsResponse, requireAuth } from "../../../../lib/route-helpers";

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireAuth(request);
    const response = await getFavoriteListings(currentUser.userId);
    return jsonResponse(favoritesResponseSchema.parse(response));
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
