import { z } from "zod";
import {
  listingDetailSchema,
  listingsResponseSchema
} from "../schemas/listings";
import type { ListingDetail, ListingsResponse } from "../types/listings";

type Fetcher = typeof fetch;

export type ApiClientOptions = {
  baseUrl?: string;
  fetch?: Fetcher;
};

export type ListListingsOptions = {
  limit?: number;
  cursor?: string | null;
};

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

async function request<T>(
  fetcher: Fetcher,
  url: string,
  schema: z.ZodType<T>
): Promise<T> {
  const response = await fetcher(url, {
    headers: { accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`API request failed with HTTP ${response.status}: ${url}`);
  }

  return schema.parse(await response.json());
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = options.baseUrl ?? "http://localhost:3100";
  const fetcher = options.fetch ?? fetch;

  return {
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
          listingsResponseSchema
        );
      },
      get(id: string): Promise<ListingDetail> {
        return request(
          fetcher,
          apiUrl(baseUrl, `/api/listings/${encodeURIComponent(id)}`),
          listingDetailSchema
        );
      }
    }
  };
}
