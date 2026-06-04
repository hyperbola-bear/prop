import { describe, expect, it } from "vitest";
import {
  formatUnreadBadge,
  jwtSubject,
  messageSenderLabel,
  shouldShowScamWarning,
  totalUnreadCount
} from "../messaging";

describe("mobile messaging helpers", () => {
  it("matches the web scam-warning threshold", () => {
    expect(shouldShowScamWarning(70)).toBe(false);
    expect(shouldShowScamWarning(71)).toBe(true);
  });

  it("labels current-user messages as yours", () => {
    expect(messageSenderLabel({ senderUserId: "user-1" }, "user-1")).toBe("You");
    expect(messageSenderLabel({ senderUserId: "user-2" }, "user-1")).toBe("Other party");
  });

  it("sums unread counts across conversations", () => {
    expect(
      totalUnreadCount([
        { unread_count: 2 },
        { unread_count: 0 },
        { unread_count: 3 }
      ])
    ).toBe(5);
  });

  it("formats unread badges compactly", () => {
    expect(formatUnreadBadge(0)).toBe("");
    expect(formatUnreadBadge(4)).toBe("4");
    expect(formatUnreadBadge(130)).toBe("99+");
  });

  it("reads the subject from a JWT payload", () => {
    const payload = globalThis
      .btoa(JSON.stringify({ sub: "user-123" }))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    expect(jwtSubject(`header.${payload}.signature`)).toBe("user-123");
    expect(jwtSubject("not-a-jwt")).toBeNull();
  });
});
