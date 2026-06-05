import { createApiClient } from "../../../packages/shared/src/api-client";

type ServerApiClientOptions = {
  cache?: RequestCache;
};

export function serverApiClient(options: ServerApiClientOptions = {}) {
  const cache = options.cache ?? "no-store";
  const serverFetch: typeof fetch = (input, init) =>
    fetch(input, { ...init, cache });

  return createApiClient({
    baseUrl: process.env.PROPPY_API_BASE_URL ?? "http://localhost:3100",
    fetch: serverFetch
  });
}
