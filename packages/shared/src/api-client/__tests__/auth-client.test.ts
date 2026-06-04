import { describe, expect, it, vi } from "vitest";
import { ApiClientError, createApiClient } from "../listings";

describe("shared API auth client", () => {
  it("attaches bearer JWTs from the getToken callback", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        email: "renter1@proppy.test",
        name: null,
        phone: "+6580000005",
        roles: ["buyer"]
      })
    );
    const client = createApiClient({
      baseUrl: "http://localhost:3100",
      fetch: fetcher,
      getToken: () => "signed.jwt.token"
    });

    await client.auth.me();

    const calls = fetcher.mock.calls as unknown as Array<
      [unknown, RequestInit]
    >;
    const init = calls[0]?.[1];
    expect(init?.headers).toBeInstanceOf(Headers);
    expect((init?.headers as Headers).get("Authorization")).toBe(
      "Bearer signed.jwt.token"
    );
  });

  it("does not attach Authorization when no JWT is available", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        items: [],
        cursor: null
      })
    );
    const client = createApiClient({
      baseUrl: "http://localhost:3100",
      fetch: fetcher,
      getToken: () => null
    });

    await client.listings.list();

    const calls = fetcher.mock.calls as unknown as Array<
      [unknown, RequestInit]
    >;
    const init = calls[0]?.[1];
    expect((init?.headers as Headers).get("Authorization")).toBeNull();
  });

  it("surfaces response status and error codes for failed auth requests", async () => {
    const fetcher = vi.fn(async () =>
      Response.json(
        {
          error: {
            code: "token_expired",
            message: "Your session has expired"
          }
        },
        { status: 401 }
      )
    );
    const client = createApiClient({
      baseUrl: "http://localhost:3100",
      fetch: fetcher,
      getToken: () => "expired.jwt"
    });

    await expect(client.auth.me()).rejects.toMatchObject({
      code: "token_expired",
      message: "Your session has expired",
      name: "ApiClientError",
      status: 401
    } satisfies Partial<ApiClientError>);
  });

  it("patches saved searches with JSON and forwards bearer auth", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        id: "11111111-1111-4111-8111-111111111111",
        user_id: "22222222-2222-4222-8222-222222222222",
        name: "Tampines alerts",
        query: { town: "TAMPINES" },
        notify_email: false,
        created_at: "2026-06-04T00:00:00.000Z",
        updated_at: "2026-06-04T00:00:01.000Z",
        last_run_at: "2026-06-04T00:00:00.000Z"
      })
    );
    const client = createApiClient({
      baseUrl: "http://localhost:3100",
      fetch: fetcher,
      getToken: () => "signed.jwt.token"
    });

    await expect(
      client.savedSearches.update("11111111-1111-4111-8111-111111111111", {
        notify_email: false
      })
    ).resolves.toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      notify_email: false
    });

    const calls = fetcher.mock.calls as unknown as Array<
      [unknown, RequestInit]
    >;
    const [url, init] = calls[0] ?? [];
    expect(url).toBe(
      "http://localhost:3100/api/saved-searches/11111111-1111-4111-8111-111111111111"
    );
    expect(init?.method).toBe("PATCH");
    expect(init?.body).toBe(JSON.stringify({ notify_email: false }));
    expect((init?.headers as Headers).get("Content-Type")).toBe(
      "application/json"
    );
    expect((init?.headers as Headers).get("Authorization")).toBe(
      "Bearer signed.jwt.token"
    );
  });
});
