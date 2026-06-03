const TOKEN_ENDPOINT = "https://www.onemap.gov.sg/api/auth/post/getToken";
const REFRESH_AFTER_MS = 2.5 * 24 * 60 * 60 * 1000;

try {
  process.loadEnvFile(new URL("../../../../.env", import.meta.url));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
    throw error;
  }
}

type CachedToken = {
  token: string;
  expiresAt: number;
};

let cached: CachedToken | null = null;

function getRequiredCredentials(): { email: string; password: string } {
  const email = process.env.ONEMAP_EMAIL?.trim();
  const password = process.env.ONEMAP_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error("ONEMAP_EMAIL and ONEMAP_PASSWORD are required for OneMap authentication");
  }
  return { email, password };
}

export function hasOneMapCredentials(): boolean {
  return Boolean(process.env.ONEMAP_EMAIL?.trim() && process.env.ONEMAP_PASSWORD?.trim());
}

export function resetOneMapTokenCache(): void {
  cached = null;
}

export async function getOneMapToken(now = Date.now): Promise<string> {
  const currentTime = now();
  if (cached && cached.expiresAt > currentTime) {
    return cached.token;
  }

  const { email, password } = getRequiredCredentials();
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    throw new Error(`OneMap token request failed with HTTP ${response.status}`);
  }

  const body = (await response.json()) as { access_token?: unknown };
  if (typeof body.access_token !== "string" || !body.access_token) {
    throw new Error("OneMap token response did not include access_token");
  }

  cached = {
    token: body.access_token,
    expiresAt: currentTime + REFRESH_AFTER_MS
  };

  return cached.token;
}
