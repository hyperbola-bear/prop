import {
  ApiClientError,
  type AuthenticatedUser
} from "@proppy/shared/api-client";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { Platform } from "react-native";
import { mobileApiClient } from "./api";
import { setMobileApiToken } from "./auth-token";

const TOKEN_STORAGE_KEY = "proppy.auth.token";
const INVALID_STORED_JWT_ERROR_CODES = new Set([
  "invalid_token",
  "token_expired",
  "unauthorized"
]);

type AuthContextValue = {
  token: string | null;
  user: AuthenticatedUser | null;
  isHydrating: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AUTH_TOKEN_STORAGE_KEY = TOKEN_STORAGE_KEY;

async function readStoredToken() {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(TOKEN_STORAGE_KEY) ?? null;
  }

  return SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
}

async function writeStoredToken(token: string) {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(TOKEN_STORAGE_KEY, token);
    return;
  }

  await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token);
}

export async function getAuthToken() {
  return readStoredToken();
}

export async function storeAuthToken(token: string) {
  await writeStoredToken(token);
}

export async function deleteStoredToken() {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(TOKEN_STORAGE_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
}

export function isInvalidStoredJwtError(cause: unknown) {
  return (
    cause instanceof ApiClientError &&
    (cause.status === 401 ||
      (cause.code
        ? INVALID_STORED_JWT_ERROR_CODES.has(cause.code.toLowerCase())
        : false))
  );
}

type ClearLocalAuthSessionOptions = {
  setTokenState?: (token: string | null) => void;
  setUserState?: (user: AuthenticatedUser | null) => void;
};

export async function clearLocalAuthSession({
  setTokenState,
  setUserState
}: ClearLocalAuthSessionOptions = {}) {
  await deleteStoredToken();
  setMobileApiToken(null);
  setTokenState?.(null);
  setUserState?.(null);
}

type RefreshUserOptions = {
  loadUser: () => Promise<AuthenticatedUser>;
  clearSession: () => Promise<void>;
  setUserState: (user: AuthenticatedUser | null) => void;
};

export async function refreshUserOrClearInvalidToken({
  loadUser,
  clearSession,
  setUserState
}: RefreshUserOptions) {
  try {
    const nextUser = await loadUser();
    setUserState(nextUser);
  } catch (cause) {
    setUserState(null);
    if (isInvalidStoredJwtError(cause)) {
      await clearSession();
    }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  const clearSessionLocally = useCallback(
    () => clearLocalAuthSession({ setTokenState: setToken, setUserState: setUser }),
    []
  );

  const refreshUser = useCallback(async () => {
    await refreshUserOrClearInvalidToken({
      clearSession: clearSessionLocally,
      loadUser: () => mobileApiClient.auth.me(),
      setUserState: setUser
    });
  }, [clearSessionLocally]);

  const signIn = useCallback(
    async (nextToken: string) => {
      await writeStoredToken(nextToken);
      setMobileApiToken(nextToken);
      setToken(nextToken);
      await refreshUser();
    },
    [refreshUser]
  );

  const signOut = useCallback(async () => {
    try {
      await mobileApiClient.auth.logout();
    } catch {
      // Local logout must still clear the JWT even if the API is unavailable.
    }
    await deleteStoredToken();
    setMobileApiToken(null);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let isMounted = true;

    readStoredToken()
      .then(async (storedToken) => {
        if (!isMounted) {
          return;
        }
        setMobileApiToken(storedToken);
        setToken(storedToken);
        if (storedToken) {
          await refreshUser();
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsHydrating(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [refreshUser]);

  const value = useMemo<AuthContextValue>(
    () => ({ token, user, isHydrating, signIn, signOut, refreshUser }),
    [isHydrating, refreshUser, signIn, signOut, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return value;
}
