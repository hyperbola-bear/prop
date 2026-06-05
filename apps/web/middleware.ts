import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE_NAME = "authjs.session-token";
const LEGACY_SESSION_COOKIE_NAME = "next-auth.session-token";

const securityHeaders = {
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' http://localhost:9000 data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:9000;",
  "X-Content-Type-Options": "nosniff"
};

function jwtSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-jwt-secret");
}

async function hasAdminRole(request: NextRequest): Promise<boolean> {
  const token =
    request.cookies.get(SESSION_COOKIE_NAME)?.value ??
    request.cookies.get(LEGACY_SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return false;
  }

  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    return (
      payload.purpose === "session" &&
      Array.isArray(payload.roles) &&
      payload.roles.includes("admin")
    );
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin") && !(await hasAdminRole(request))) {
    return new NextResponse("403 Forbidden", {
      status: 403,
      headers: securityHeaders
    });
  }

  const response = NextResponse.next({ request });
  for (const [name, value] of Object.entries(securityHeaders)) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  matcher: "/:path*"
};
