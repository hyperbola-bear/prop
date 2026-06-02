let currentAuthToken: string | null = null;

export function setMobileApiToken(token: string | null) {
  currentAuthToken = token;
}

export function getMobileApiToken() {
  return currentAuthToken;
}
