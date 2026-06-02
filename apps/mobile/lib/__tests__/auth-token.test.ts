import { describe, expect, it } from "vitest";
import { getMobileApiToken, setMobileApiToken } from "../auth-token";

describe("mobile API auth token cache", () => {
  it("stores the signed-in JWT for subsequent API client requests", () => {
    setMobileApiToken("jwt-token");

    expect(getMobileApiToken()).toBe("jwt-token");
  });

  it("clears the JWT on sign out", () => {
    setMobileApiToken("jwt-token");
    setMobileApiToken(null);

    expect(getMobileApiToken()).toBeNull();
  });
});
