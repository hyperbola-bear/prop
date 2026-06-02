import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../listings";

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
});
