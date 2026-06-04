import { z } from "zod";
import {
  addListingPhotoSchema,
  createListingSchema,
  listingDetailSchema,
  listingsResponseSchema,
  ownedListingDetailSchema,
  ownedListingsResponseSchema,
  patchListingSchema,
  presignUploadSchema,
  reorderListingPhotosSchema
} from "../schemas/listings";
import type {
  AddRoleInput,
  LoginInput,
  OtpVerifyInput,
  SignupInput
} from "../schemas/auth";
import type {
  ListingDetail,
  ListingsResponse,
  OwnedListingDetail
} from "../types/listings";

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
const sellerClientSchema = z.object({
  id: z.uuid(),
  email: z.string().email(),
  phone: z.string().nullable(),
  name: z.string().nullable()
});
const sellerClientsResponseSchema = z.object({
  items: z.array(sellerClientSchema)
});
const createListingResponseSchema = z.object({
  id: z.uuid(),
  status: z.string().min(1)
});
const updateListingResponseSchema = z.object({
  id: z.uuid(),
  status: z.string().min(1)
});
const statusResponseSchema = z.object({
  status: z.string().min(1)
});
const refreshResponseSchema = z.object({
  refreshed: z.boolean()
});
const presignUploadResponseSchema = z.object({
  url: z.string().url(),
  fields: z.record(z.string(), z.string()),
  key: z.string().min(1),
  maxSizeBytes: z.number().int().positive().optional(),
  method: z.enum(["POST", "PUT"]).optional(),
  headers: z.record(z.string(), z.string()).optional()
});
const addPhotoResponseSchema = z.object({
  id: z.uuid(),
  sortOrder: z.number().int()
});
const floorPlanResponseSchema = z.object({
  id: z.uuid()
});
const resolveAddressInputSchema = z.object({
  block: z.string().min(1),
  street: z.string().min(1),
  postal: z.string().optional(),
  building: z.string().optional(),
  address: z.string().optional(),
  lat: z.string().optional(),
  lng: z.string().optional()
});
const resolveAddressResponseSchema = z.object({
  addressId: z.uuid(),
  blockId: z.uuid(),
  town: z.string().min(1)
});
const onemapSuggestionSchema = z.object({
  SEARCHVAL: z.string(),
  BLK_NO: z.string(),
  ROAD_NAME: z.string(),
  BUILDING: z.string(),
  ADDRESS: z.string(),
  POSTAL: z.string(),
  LATITUDE: z.string(),
  LONGITUDE: z.string()
});
const onemapSuggestionsSchema = z.array(onemapSuggestionSchema);

export type CreateListingInput = z.input<typeof createListingSchema>;
export type PatchListingInput = z.input<typeof patchListingSchema>;
export type PresignUploadInput = z.input<typeof presignUploadSchema>;
export type AddListingPhotoInput = z.input<typeof addListingPhotoSchema>;
export type ReorderListingPhotosInput = z.infer<typeof reorderListingPhotosSchema>;
export type ResolveAddressInput = z.infer<typeof resolveAddressInputSchema>;
export type OnemapSuggestion = z.infer<typeof onemapSuggestionSchema>;

export type AuthenticatedUser = z.infer<typeof meResponseSchema>;
export type SellerClient = z.infer<typeof sellerClientSchema>;

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

function jsonPatch(body: unknown): RequestInit {
  return {
    method: "PATCH",
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
      },
      create(input: CreateListingInput) {
        return request(
          fetcher,
          apiUrl(baseUrl, "/api/listings"),
          createListingResponseSchema,
          jsonPost(input),
          getToken
        );
      },
      update(id: string, input: PatchListingInput) {
        return request(
          fetcher,
          apiUrl(baseUrl, `/api/listings/${encodeURIComponent(id)}`),
          updateListingResponseSchema,
          jsonPatch(input),
          getToken
        );
      },
      publish(id: string) {
        return request(
          fetcher,
          apiUrl(baseUrl, `/api/listings/${encodeURIComponent(id)}/publish`),
          statusResponseSchema,
          { method: "POST" },
          getToken
        );
      },
      addPhoto(id: string, input: AddListingPhotoInput) {
        return request(
          fetcher,
          apiUrl(baseUrl, `/api/listings/${encodeURIComponent(id)}/photos`),
          addPhotoResponseSchema,
          jsonPost(input),
          getToken
        );
      },
      reorderPhotos(id: string, input: ReorderListingPhotosInput) {
        return request(
          fetcher,
          apiUrl(baseUrl, `/api/listings/${encodeURIComponent(id)}/photos/reorder`),
          okResponseSchema,
          jsonPatch(input),
          getToken
        );
      },
      addFloorPlan(id: string, input: { key: string; zone?: { roomTag: string } }) {
        return request(
          fetcher,
          apiUrl(baseUrl, `/api/listings/${encodeURIComponent(id)}/floor-plan`),
          floorPlanResponseSchema,
          jsonPost(input),
          getToken
        );
      },
      pause(id: string) {
        return request(
          fetcher,
          apiUrl(baseUrl, `/api/listings/${encodeURIComponent(id)}/pause`),
          statusResponseSchema,
          { method: "POST" },
          getToken
        );
      },
      refresh(id: string) {
        return request(
          fetcher,
          apiUrl(baseUrl, `/api/listings/${encodeURIComponent(id)}/refresh`),
          refreshResponseSchema,
          { method: "POST" },
          getToken
        );
      },
      markRented(id: string) {
        return request(
          fetcher,
          apiUrl(baseUrl, `/api/listings/${encodeURIComponent(id)}/mark-rented`),
          statusResponseSchema,
          { method: "POST" },
          getToken
        );
      },
      delist(id: string) {
        return request(
          fetcher,
          apiUrl(baseUrl, `/api/listings/${encodeURIComponent(id)}/delist`),
          statusResponseSchema,
          { method: "POST" },
          getToken
        );
      }
    },
    me: {
      listings() {
        return request(
          fetcher,
          apiUrl(baseUrl, "/api/me/listings"),
          ownedListingsResponseSchema,
          {},
          getToken
        );
      },
      listing(id: string): Promise<OwnedListingDetail> {
        return request(
          fetcher,
          apiUrl(baseUrl, `/api/me/listings/${encodeURIComponent(id)}`),
          ownedListingDetailSchema,
          {},
          getToken
        );
      },
      clients(query = "") {
        const params = new URLSearchParams();
        if (query) {
          params.set("q", query);
        }
        return request(
          fetcher,
          apiUrl(baseUrl, "/api/me/clients", params),
          sellerClientsResponseSchema,
          {},
          getToken
        );
      },
      createClient(input: { email: string }) {
        return request(
          fetcher,
          apiUrl(baseUrl, "/api/me/clients"),
          sellerClientSchema,
          jsonPost(input),
          getToken
        );
      }
    },
    uploads: {
      presign(input: PresignUploadInput) {
        return request(
          fetcher,
          apiUrl(baseUrl, "/api/uploads/presign"),
          presignUploadResponseSchema,
          jsonPost(input),
          getToken
        );
      }
    },
    addresses: {
      resolve(input: ResolveAddressInput) {
        return request(
          fetcher,
          apiUrl(baseUrl, "/api/addresses/resolve"),
          resolveAddressResponseSchema,
          jsonPost(input),
          getToken
        );
      }
    },
    onemap: {
      search(query: string): Promise<OnemapSuggestion[]> {
        const params = new URLSearchParams({ q: query });
        return request(
          fetcher,
          apiUrl(baseUrl, "/api/onemap/search", params),
          onemapSuggestionsSchema,
          {},
          getToken
        );
      }
    }
  };
}
