import { z } from "zod";
import {
  listingDetailSchema,
  listingsResponseSchema
} from "../schemas/listings";
import type {
  AddRoleInput,
  LoginInput,
  OtpVerifyInput,
  SignupInput
} from "../schemas/auth";
import type { ListingDetail, ListingsResponse } from "../types/listings";

type Fetcher = typeof fetch;

export type ApiClientOptions = {
  baseUrl?: string;
  fetch?: Fetcher;
  getToken?: () => Promise<string | null> | string | null;
};

export type ListListingsOptions = {
  limit?: number;
  cursor?: string | null;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function apiUrl(baseUrl: string, path: string, params?: URLSearchParams): string {
  const url = new URL(path, `${normalizeBaseUrl(baseUrl)}/`);
  if (params) {
    url.search = params.toString();
  }
  return url.toString();
}

const tokenResponseSchema = z.object({ token: z.string().min(1) });
const signupResponseSchema = z.object({
  userId: z.string().min(1),
  requiresPhoneVerification: z.literal(true)
});
const meResponseSchema = z.object({
  email: z.string().email(),
  name: z.string().nullable().optional(),
  phone: z.string(),
  roles: z.array(z.string())
});
const rolesResponseSchema = z.object({ roles: z.array(z.string()) });
const okResponseSchema = z.object({ ok: z.boolean() });

export type AuthenticatedUser = z.infer<typeof meResponseSchema>;

async function request<T>(
  fetcher: Fetcher,
  url: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
  getToken?: ApiClientOptions["getToken"]
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  const token = getToken ? await getToken() : null;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetcher(url, { ...init, headers });

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const errorPayload =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "object" &&
      payload.error !== null
        ? payload.error
        : null;
    const message =
      errorPayload &&
      "message" in errorPayload &&
      typeof errorPayload.message === "string"
        ? errorPayload.message
        : `API request failed with HTTP ${response.status}: ${url}`;
    const code =
      errorPayload &&
      "code" in errorPayload &&
      typeof errorPayload.code === "string"
        ? errorPayload.code
        : undefined;
    throw new ApiClientError(message, response.status, code);
  }

  return schema.parse(await response.json());
}

function jsonPost(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? "http://localhost:3100";
  const fetcher = options.fetch ?? fetch;
  const getToken = options.getToken;

  return {
    auth: {
      signup(input: SignupInput) {
        return request(
          fetcher,
          apiUrl(baseUrl, "/api/auth/signup"),
          signupResponseSchema,
          jsonPost(input)
        );
      },
      verifyOtp(input: OtpVerifyInput) {
        return request(
          fetcher,
          apiUrl(baseUrl, "/api/auth/otp/verify"),
          tokenResponseSchema,
          jsonPost(input)
        );
      },
      login(input: LoginInput) {
        return request(
          fetcher,
          apiUrl(baseUrl, "/api/auth/login"),
          tokenResponseSchema,
          jsonPost(input)
        );
      },
      me() {
        return request(
          fetcher,
          apiUrl(baseUrl, "/api/me"),
          meResponseSchema,
          {},
          getToken
        );
      },
      addRole(input: AddRoleInput) {
        return request(
          fetcher,
          apiUrl(baseUrl, "/api/me/roles"),
          rolesResponseSchema,
          jsonPost(input),
          getToken
        );
      },
      logout() {
        return request(
          fetcher,
          apiUrl(baseUrl, "/api/auth/logout"),
          okResponseSchema,
          { method: "POST" },
          getToken
        );
      }
    },
    listings: {
      list(input: ListListingsOptions = {}): Promise<ListingsResponse> {
        const params = new URLSearchParams();
        if (input.limit !== undefined) {
          params.set("limit", String(input.limit));
        }
        if (input.cursor) {
          params.set("cursor", input.cursor);
        }

        return request(
          fetcher,
          apiUrl(baseUrl, "/api/listings", params),
          listingsResponseSchema,
          {},
          getToken
        );
      },
      get(id: string): Promise<ListingDetail> {
        return request(
          fetcher,
          apiUrl(baseUrl, `/api/listings/${encodeURIComponent(id)}`),
          listingDetailSchema,
          {},
          getToken
        );
      }
    }
  };
}
