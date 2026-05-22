import { NextRequest } from "next/server";
import { ZodError } from "zod";
import {
  listingsQuerySchema,
  listingsResponseSchema
} from "../../../../../packages/shared/src/schemas";
import { publicJson, publicOptions } from "../_cors";
import { getPublicListings, InvalidCursorError } from "../../../lib/listings";

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

export function OPTIONS() {
  return publicOptions();
}
