import { NextResponse } from "next/server";

export const publicApiCorsHeaders = {
  "Access-Control-Allow-Headers": "Accept, Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Origin": "http://localhost:3101",
  Vary: "Origin"
};

export function publicJson<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...publicApiCorsHeaders,
      ...init?.headers
    }
  });
}

export function publicOptions() {
  return new NextResponse(null, {
    status: 204,
    headers: publicApiCorsHeaders
  });
}
