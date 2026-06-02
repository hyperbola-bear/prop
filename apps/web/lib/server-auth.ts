import { cookies } from "next/headers";
import {
  LEGACY_SESSION_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  verifyAuthToken
} from "./auth-context";
import { userById, type UserWithRoles } from "./auth-service";

export async function currentSessionUser(): Promise<UserWithRoles | null> {
  const cookieStore = await cookies();
  const token =
    cookieStore.get(SESSION_COOKIE_NAME)?.value ??
    cookieStore.get(LEGACY_SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const payload = await verifyAuthToken(token);
    if (payload.purpose !== "session") {
      return null;
    }

    return userById(payload.sub);
  } catch {
    return null;
  }
}
