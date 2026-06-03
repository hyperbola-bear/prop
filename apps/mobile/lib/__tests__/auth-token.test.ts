import { ApiClientError, type AuthenticatedUser } from "@proppy/shared/api-client";
import * as SecureStore from "expo-secure-store";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTH_TOKEN_STORAGE_KEY,
  clearLocalAuthSession,
  getAuthToken,
  refreshUserOrClearInvalidToken,
  storeAuthToken
} from "../auth-context";
import { getMobileApiToken, setMobileApiToken } from "../auth-token";

const testState = vi.hoisted(() => ({
  platformOS: "web",
  secureStore: new Map<string, string>()
}));

vi.mock("react-native", () => ({
  Platform: {
    get OS() {
      return testState.platformOS;
    }
  }
}));

vi.mock("expo-secure-store", () => ({
  deleteItemAsync: vi.fn(async (key: string) => {
    testState.secureStore.delete(key);
  }),
  getItemAsync: vi.fn(async (key: string) => testState.secureStore.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    testState.secureStore.set(key, value);
  })
}));

const fixtureUser: AuthenticatedUser = {
  email: "renter1@proppy.test",
  name: null,
  phone: "+6580000005",
  roles: ["buyer"]
};

function installLocalStorage() {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      clear: vi.fn(() => values.clear()),
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      removeItem: vi.fn((key: string) => {
        values.delete(key);
      }),
      setItem: vi.fn((key: string, value: string) => {
        values.set(key, value);
      })
    }
  });
  return values;
}

describe("mobile API auth token cache", () => {
  beforeEach(() => {
    testState.platformOS = "web";
    testState.secureStore.clear();
    installLocalStorage();
    setMobileApiToken(null);
    vi.clearAllMocks();
  });

  it("stores the signed-in JWT for subsequent API client requests", () => {
    setMobileApiToken("jwt-token");

    expect(getMobileApiToken()).toBe("jwt-token");
  });

  it("clears the JWT on sign out", () => {
    setMobileApiToken("jwt-token");
    setMobileApiToken(null);

    expect(getMobileApiToken()).toBeNull();
  });

  it("clears the stored JWT when refreshUser sees an unauthorized /api/me response", async () => {
    let tokenState: string | null = "expired.bad.jwt";
    let userState: AuthenticatedUser | null = fixtureUser;
    await storeAuthToken("expired.bad.jwt");
    setMobileApiToken("expired.bad.jwt");

    await refreshUserOrClearInvalidToken({
      clearSession: () =>
        clearLocalAuthSession({
          setTokenState: (nextToken) => {
            tokenState = nextToken;
          },
          setUserState: (nextUser) => {
            userState = nextUser;
          }
        }),
      loadUser: async () => {
        throw new ApiClientError("Unauthorized", 401, "unauthorized");
      },
      setUserState: (nextUser) => {
        userState = nextUser;
      }
    });

    expect(tokenState).toBeNull();
    expect(userState).toBeNull();
    expect(getMobileApiToken()).toBeNull();
    await expect(getAuthToken()).resolves.toBeNull();
    expect(globalThis.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it("clears the native SecureStore JWT when refreshUser sees an invalid-token error code", async () => {
    testState.platformOS = "ios";
    await storeAuthToken("expired.bad.jwt");
    setMobileApiToken("expired.bad.jwt");

    await refreshUserOrClearInvalidToken({
      clearSession: () => clearLocalAuthSession(),
      loadUser: async () => {
        throw new ApiClientError("Token expired", 400, "token_expired");
      },
      setUserState: vi.fn()
    });

    expect(getMobileApiToken()).toBeNull();
    await expect(getAuthToken()).resolves.toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(AUTH_TOKEN_STORAGE_KEY);
  });

  it("preserves the stored JWT when refreshUser sees a transient network error", async () => {
    const clearSession = vi.fn(async () => clearLocalAuthSession());
    await storeAuthToken("still.valid.jwt");
    setMobileApiToken("still.valid.jwt");

    await expect(
      refreshUserOrClearInvalidToken({
        clearSession,
        loadUser: async () => {
          throw new TypeError("fetch failed");
        },
        setUserState: vi.fn()
      })
    ).resolves.toBeUndefined();

    expect(clearSession).not.toHaveBeenCalled();
    expect(getMobileApiToken()).toBe("still.valid.jwt");
    await expect(getAuthToken()).resolves.toBe("still.valid.jwt");
    expect(globalThis.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe(
      "still.valid.jwt"
    );
  });

  it("preserves the stored JWT when refreshUser sees a server error", async () => {
    const clearSession = vi.fn(async () => clearLocalAuthSession());
    await storeAuthToken("still.valid.jwt");
    setMobileApiToken("still.valid.jwt");

    await refreshUserOrClearInvalidToken({
      clearSession,
      loadUser: async () => {
        throw new ApiClientError("Service unavailable", 503);
      },
      setUserState: vi.fn()
    });

    expect(clearSession).not.toHaveBeenCalled();
    expect(getMobileApiToken()).toBe("still.valid.jwt");
    await expect(getAuthToken()).resolves.toBe("still.valid.jwt");
  });
});
