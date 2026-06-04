import { describe, expect, it } from "vitest";
import { messageSenderLabel, shouldShowScamWarning, type ChatMessage } from "./chat-utils";

function messageFixture(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    conversationId: "22222222-2222-4222-8222-222222222222",
    senderUserId: "33333333-3333-4333-8333-333333333333",
    body: "Hello",
    scam_score: 0,
    scam_flags: [],
    created_at: "2026-06-04T00:00:00.000Z",
    read_at: null,
    ...overrides
  };
}

describe("chat message UI helpers", () => {
  it("shows scam warnings only for scores above seventy", () => {
    expect(shouldShowScamWarning(71)).toBe(true);
    expect(shouldShowScamWarning(70)).toBe(false);
    expect(shouldShowScamWarning(0)).toBe(false);
    expect(shouldShowScamWarning(null)).toBe(false);
  });

  it("labels messages from the current user as You", () => {
    const message = messageFixture();
    expect(messageSenderLabel(message, message.senderUserId)).toBe("You");
    expect(messageSenderLabel(message, "44444444-4444-4444-8444-444444444444")).toBe(
      "Other party"
    );
  });
});
