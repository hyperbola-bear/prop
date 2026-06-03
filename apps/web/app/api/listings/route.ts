import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { listings } from "../../../../../packages/db/schema";
import {
  createListingSchema,
  listingsQuerySchema,
  listingsResponseSchema
} from "../../../../../packages/shared/src/schemas";
import { publicJson } from "../_cors";
import { db } from "../../../lib/db";
import { getPublicListings, InvalidCursorError } from "../../../lib/listings";
import { checkRateLimit, createListingRateLimits } from "../../../lib/rate-limit";
import {
  ForbiddenError,
  jsonError,
  jsonResponse,
  mapError,
  optionsResponse,
  requireAuth
} from "../../../lib/route-helpers";

function zodFieldErrors(error: ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map((issue) => [issue.path.join(".") || "request", issue.message])
  );
}

export async function GET(request: NextRequest) {
  try {
    const query = listingsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries())
    );
    const response = listingsResponseSchema.parse(await getPublicListings(query));
    return publicJson(response);
  } catch (error) {
    if (error instanceof ZodError) {
      return publicJson(
        {
          error: {
            code: "invalid_request",
            message: "Invalid listings query",
            fieldErrors: zodFieldErrors(error)
          }
        },
        { status: 400 }
      );
    }

    if (error instanceof InvalidCursorError) {
      return publicJson(
        {
          error: {
            code: "invalid_cursor",
            message: "Invalid listings cursor"
          }
        },
        { status: 400 }
      );
    }

    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAuth(request);
    if (currentUser.roles.includes("buyer") && !currentUser.roles.includes("seller") && !currentUser.roles.includes("agent")) {
      throw new ForbiddenError("Buyers cannot create listings");
    }

    const rateLimit = checkRateLimit(currentUser.userId, createListingRateLimits);
    if (!rateLimit.ok) {
      return jsonError(429, "rate_limited", "Try again later", undefined, {
        "Retry-After": String(rateLimit.retryAfterSec)
      });
    }

    const body = createListingSchema.parse(await request.json().catch(() => ({})));
    const isAgentListing =
      currentUser.roles.includes("agent") && body.ownerUserId && body.mandateVia;
    const ownerUserId = isAgentListing ? body.ownerUserId! : currentUser.userId;
    const agentUserId = isAgentListing ? currentUser.userId : null;
    const representedVia = isAgentListing ? body.mandateVia! : "owner";

    if ((body.ownerUserId || body.mandateVia) && !isAgentListing) {
      throw new ForbiddenError("Agent mandate is required to create on behalf of an owner");
    }

    const [created] = await db
      .insert(listings)
      .values({
        ownerUserId,
        agentUserId,
        representedVia,
        status: "draft",
        listingType: "rental",
        propertyType: "hdb",
        title: body.title ?? "Untitled HDB rental",
        description: body.description,
        priceSgd: BigInt(body.priceSgd ?? 0)
      })
      .returning({ id: listings.id, status: listings.status });

    return jsonResponse(created, { status: 201 });
  } catch (error) {
    return mapError(error);
  }
}

export function OPTIONS() {
  return optionsResponse();
}
