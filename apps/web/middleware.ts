import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const securityHeaders = {
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' http://localhost:9000 data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:9000;",
  "X-Content-Type-Options": "nosniff"
};

export function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  for (const [name, value] of Object.entries(securityHeaders)) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  matcher: "/:path*"
};
