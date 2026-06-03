import { afterEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MyInfoCallbackPage from "./page";

const originalMyInfoEnabled = process.env.AUTH_MYINFO_ENABLED;

describe("MyInfo callback page", () => {
  afterEach(() => {
    if (originalMyInfoEnabled === undefined) {
      delete process.env.AUTH_MYINFO_ENABLED;
    } else {
      process.env.AUTH_MYINFO_ENABLED = originalMyInfoEnabled;
    }
  });

  it("returns a Next.js 404 when MyInfo is disabled by default", () => {
    delete process.env.AUTH_MYINFO_ENABLED;

    try {
      MyInfoCallbackPage();
      throw new Error("Expected MyInfoCallbackPage to throw notFound()");
    } catch (error) {
      const digest =
        typeof error === "object" && error !== null && "digest" in error
          ? String(error.digest)
          : String(error);
      expect(digest).toContain("404");
    }
  });

  it("renders the prefilled MyInfo signup form when MyInfo is enabled", () => {
    process.env.AUTH_MYINFO_ENABLED = "true";

    const html = renderToStaticMarkup(<MyInfoCallbackPage />);

    expect(html).toContain("Complete signup with MyInfo");
    expect(html).toContain("Tan Wei Ming");
    expect(html).toContain("S1234567A");
    expect(html).toContain("+6581234567");
  });
});
