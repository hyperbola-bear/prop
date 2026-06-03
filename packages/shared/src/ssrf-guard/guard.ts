import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const ALLOWED_ONEMAP_HOSTS = [
  "www.onemap.gov.sg",
  "maps-a.onemap.gov.sg",
  "maps-b.onemap.gov.sg",
  "maps-c.onemap.gov.sg",
  "eservices.onemap.gov.sg"
] as const;

export type SsrfErrorCode =
  | "invalid_url"
  | "invalid_protocol"
  | "host_not_whitelisted"
  | "private_address_blocked";

export class SsrfError extends Error {
  constructor(
    public readonly code: SsrfErrorCode,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "SsrfError";
  }
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[(.*)]$/, "$1").toLowerCase();
}

export function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second] = octets as [number, number, number, number];
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = normalizeHostname(address);
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedIpv4?.[1]) {
    return isPrivateIpv4(mappedIpv4[1]);
  }

  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

export function isPrivateIpAddress(address: string): boolean {
  const normalized = normalizeHostname(address);
  const version = isIP(normalized);
  if (version === 4) {
    return isPrivateIpv4(normalized);
  }
  if (version === 6) {
    return isPrivateIpv6(normalized);
  }
  return false;
}

function assertNotPrivateAddress(address: string): void {
  if (isPrivateIpAddress(address)) {
    throw new SsrfError(
      "private_address_blocked",
      403,
      "Host resolves to a private, loopback, or link-local address"
    );
  }
}

export async function assertUrlSafe(rawUrl: string | null | undefined): Promise<URL> {
  if (!rawUrl) {
    throw new SsrfError("invalid_url", 400, "URL is required");
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError("invalid_url", 400, "URL is malformed");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError("invalid_protocol", 400, "Only http and https URLs are allowed");
  }

  const hostname = normalizeHostname(url.hostname);
  if (!hostname) {
    throw new SsrfError("invalid_url", 400, "URL host is required");
  }

  assertNotPrivateAddress(hostname);

  if (!ALLOWED_ONEMAP_HOSTS.includes(hostname as (typeof ALLOWED_ONEMAP_HOSTS)[number])) {
    if (hostname === "localhost") {
      const addresses = await lookup(hostname, { all: true });
      for (const { address } of addresses) {
        assertNotPrivateAddress(address);
      }
    }

    throw new SsrfError("host_not_whitelisted", 400, "Host not in OneMap whitelist");
  }

  const addresses = await lookup(hostname, { all: true });
  for (const { address } of addresses) {
    assertNotPrivateAddress(address);
  }

  return url;
}
