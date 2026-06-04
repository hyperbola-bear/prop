import { createApiClient } from "@proppy/shared/api-client";
import { getMobileApiToken } from "./auth-token";

export const mobileApiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE ?? "http://localhost:3100";

export const mobileApiClient = createApiClient({
  baseUrl: mobileApiBaseUrl,
  getToken: getMobileApiToken
});
