import { NextRequest } from "next/server";
import { assertUrlSafe, SsrfError } from "../../../../../../packages/shared/src/ssrf-guard";
import { publicOptions } from "../../_cors";
import { apiCorsHeaders, jsonError, securityHeaders } from "../../../../lib/route-helpers";

function proxyResponseHeaders(upstreamHeaders: Headers): Headers {
  const headers = new Headers({
    ...apiCorsHeaders,
    ...securityHeaders
  });

  for (const headerName of ["content-type", "cache-control", "etag", "last-modified"]) {
    const value = upstreamHeaders.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  return headers;
}

function normalizeOneMapProxyUrl(url: URL): URL {
  const normalized = new URL(url);
  if (normalized.hostname === "www.onemap.gov.sg" && normalized.pathname === "/api/common/elastic/search") {
    if (!normalized.searchParams.has("returnGeom")) {
      normalized.searchParams.set("returnGeom", "Y");
    }
    if (!normalized.searchParams.has("getAddrDetails")) {
      normalized.searchParams.set("getAddrDetails", "Y");
    }
  }
  return normalized;
}

export async function GET(request: NextRequest) {
  try {
    const safeUrl = normalizeOneMapProxyUrl(
      await assertUrlSafe(request.nextUrl.searchParams.get("url"))
    );
    const upstream = await fetch(safeUrl, { redirect: "manual" });

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: proxyResponseHeaders(upstream.headers)
    });
  } catch (error) {
    if (error instanceof SsrfError) {
      return jsonError(error.status, error.code, error.message);
    }

    return jsonError(502, "upstream_fetch_failed", "Unable to fetch OneMap resource");
  }
}

export function OPTIONS() {
  return publicOptions();
}
