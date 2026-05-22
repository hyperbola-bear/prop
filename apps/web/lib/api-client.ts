import { createApiClient } from "../../../packages/shared/src/api-client";

const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: "no-store" });

export function serverApiClient() {
  return createApiClient({
    baseUrl: process.env.PROPPY_API_BASE_URL ?? "http://localhost:3100",
    fetch: noStoreFetch
  });
}
