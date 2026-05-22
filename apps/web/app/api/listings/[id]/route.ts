import { NextRequest } from "next/server";
import { z } from "zod";
import { listingDetailSchema } from "../../../../../../packages/shared/src/schemas";
import { publicJson, publicOptions } from "../../_cors";
import { getPublicListingDetail } from "../../../../lib/listings";

const listingIdSchema = z.uuid();

type ListingRouteContext = {
  params: Promise<{ id: string }> | { id: string };
};

export async function GET(_request: NextRequest, context: ListingRouteContext) {
  const params = await context.params;
  const parsedId = listingIdSchema.safeParse(params.id);

  if (!parsedId.success) {
    return publicJson(
      {
        error: {
          code: "not_found",
          message: "Listing not found"
        }
      },
      { status: 404 }
    );
  }

  const listing = await getPublicListingDetail(parsedId.data);

  if (!listing) {
    return publicJson(
      {
        error: {
          code: "not_found",
          message: "Listing not found"
        }
      },
      { status: 404 }
    );
  }

  return publicJson(listingDetailSchema.parse(listing));
}

export function OPTIONS() {
  return publicOptions();
}
