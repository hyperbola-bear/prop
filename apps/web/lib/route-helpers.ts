import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "./auth-context";

export const securityHeaders = {
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' http://localhost:9000 data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:9000;",
  "X-Content-Type-Options": "nosniff"
};

export const apiCorsHeaders = {
  "Access-Control-Allow-Headers": "Accept, Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Origin": "http://localhost:3101",
  Vary: "Origin"
};

export type CurrentUser = {
  userId: string;
  roles: string[];
};

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required") {
    super(message);
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
  }
}

export function zodFieldErrors(error: ZodError): Record<string, string> {
  return Object.fromEntries(
    error.issues.map((issue) => [issue.path.join(".") || "request", issue.message])
  );
}

export function jsonResponse<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...apiCorsHeaders,
      ...securityHeaders,
      ...init?.headers
    }
  });
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string>,
  headers?: HeadersInit
) {
  const init: ResponseInit = headers ? { status, headers } : { status };
  return jsonResponse(
    {
      error: {
        code,
        message,
        ...(fieldErrors ? { fieldErrors } : {})
      }
    },
    init
  );
}

export async function requireAuth(request: NextRequest): Promise<CurrentUser> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    throw new UnauthorizedError();
  }
  return currentUser;
}

export async function requireRole(request: NextRequest, role: string): Promise<CurrentUser> {
  const currentUser = await requireAuth(request);
  if (!currentUser.roles.includes(role)) {
    throw new ForbiddenError();
  }
  return currentUser;
}

export function mapError(error: unknown) {
  if (error instanceof ZodError) {
    return jsonError(400, "invalid_request", "Invalid request", zodFieldErrors(error));
  }

  if (error instanceof UnauthorizedError) {
    return jsonError(401, "unauthorized", error.message);
  }

  if (error instanceof ForbiddenError) {
    return jsonError(403, "forbidden", error.message);
  }

  if (error instanceof NotFoundError) {
    return jsonError(404, "not_found", error.message);
  }

  throw error;
}

export function optionsResponse() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...apiCorsHeaders,
      ...securityHeaders
    }
  });
}
