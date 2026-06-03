import { NextRequest } from "next/server";
import { search } from "../../../../../../packages/shared/src/onemap";
import { publicJson, publicOptions } from "../../_cors";

export async function GET(request: NextRequest) {
  const query =
    request.nextUrl.searchParams.get("q") ??
    request.nextUrl.searchParams.get("query") ??
    request.nextUrl.searchParams.get("searchVal") ??
    "";

  const results = await search(query);
  return publicJson(results);
}

export function OPTIONS() {
  return publicOptions();
}
