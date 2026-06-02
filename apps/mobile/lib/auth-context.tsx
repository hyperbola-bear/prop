import type { AuthenticatedUser } from "@proppy/shared/api-client";
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

type AuthContextValue = {
  token: string | null;
  user: AuthenticatedUser | null;
  isHydrating: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

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

async function deleteStoredToken() {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(TOKEN_STORAGE_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const nextUser = await mobileApiClient.auth.me();
      setUser(nextUser);
    } catch {
      setUser(null);
    }
  }, []);

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
