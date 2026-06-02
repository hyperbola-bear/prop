import { createApiClient } from "@proppy/shared/api-client";
import { getMobileApiToken } from "./auth-token";

export const mobileApiClient = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_BASE ?? "http://localhost:3100",
  getToken: getMobileApiToken
});
