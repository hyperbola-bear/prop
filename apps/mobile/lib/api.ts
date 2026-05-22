import { createApiClient } from "@proppy/shared/api-client";

export const mobileApiClient = createApiClient({
  baseUrl: process.env.EXPO_PUBLIC_API_BASE ?? "http://localhost:3100"
});
