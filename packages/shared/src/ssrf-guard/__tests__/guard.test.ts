import { lookup } from "node:dns/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertUrlSafe, SsrfError } from "../guard";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn()
}));

const lookupMock = vi.mocked(lookup);

function lookupResult(address: string, family: 4 | 6 = 4) {
  return [{ address, family }] as never;
}

describe("assertUrlSafe", () => {
  beforeEach(() => {
    lookupMock.mockReset();
    lookupMock.mockResolvedValue(lookupResult("18.136.1.10"));
  });

  it.each([
    ["cloud metadata", "http://169.254.169.254/latest/meta-data/"],
    ["IPv4 loopback", "http://127.0.0.1:9000/proppy/secret"],
    ["RFC1918 10/8", "http://10.0.0.5/"],
    ["RFC1918 172.16/12", "http://172.16.0.1/"],
    ["RFC1918 192.168/16", "http://192.168.1.1/"],
    ["IPv6 loopback", "http://[::1]/"],
    ["IPv6 link-local", "http://[fe80::1]/"]
  ])("blocks %s URL literals", async (_name, rawUrl) => {
    await expect(assertUrlSafe(rawUrl)).rejects.toMatchObject({
      code: "private_address_blocked",
      status: 403
    });
  });

  it("blocks localhost after DNS resolution", async () => {
    lookupMock.mockResolvedValueOnce(lookupResult("127.0.0.1"));

    await expect(assertUrlSafe("http://localhost:9000/proppy/secret")).rejects.toMatchObject({
      code: "private_address_blocked",
      status: 403
    });
  });

  it.each(["file:///etc/passwd", "gopher://evil.com/"])(
    "blocks non-http protocol %s",
    async (rawUrl) => {
      await expect(assertUrlSafe(rawUrl)).rejects.toBeInstanceOf(SsrfError);
    }
  );

  it("blocks non-whitelisted public hosts with host_not_whitelisted", async () => {
    await expect(assertUrlSafe("https://www.example.com/")).rejects.toMatchObject({
      code: "host_not_whitelisted",
      status: 400
    });
  });

  it.each([
    "https://www.onemap.gov.sg/api/common/elastic/search?searchVal=Toa%20Payoh",
    "https://maps-a.onemap.gov.sg/lite/"
  ])("allows OneMap whitelisted host %s", async (rawUrl) => {
    const url = await assertUrlSafe(rawUrl);

    expect(url.toString()).toBe(rawUrl);
    expect(lookupMock).toHaveBeenCalledWith(url.hostname, { all: true });
  });

  it("blocks whitelisted hosts if DNS resolves to a private address", async () => {
    lookupMock.mockResolvedValueOnce(lookupResult("10.0.0.10"));

    await expect(assertUrlSafe("https://www.onemap.gov.sg/api/")).rejects.toMatchObject({
      code: "private_address_blocked",
      status: 403
    });
  });
});
