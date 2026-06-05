import { describe, expect, it } from "vitest";
import {
  formatAgentResponseTime,
  validateAgentReviewDraft
} from "../../lib/agent-review-validation";

describe("agent review validation", () => {
  it("accepts a 5-star review with body text", () => {
    expect(validateAgentReviewDraft({ stars: 5, body: "Very responsive" })).toBeNull();
  });

  it("rejects stars above the 1 to 5 range", () => {
    expect(validateAgentReviewDraft({ stars: 6, body: "Too many stars" })).toBe(
      "Stars must be 1 to 5"
    );
  });

  it("rejects an empty review body", () => {
    expect(validateAgentReviewDraft({ stars: 4, body: "   " })).toBe(
      "Review body is required"
    );
  });
});

describe("agent response time formatter", () => {
  it("formats minute response times with a unit", () => {
    expect(formatAgentResponseTime(17)).toBe("17 min");
  });

  it("formats hour and minute response times", () => {
    expect(formatAgentResponseTime(133)).toBe("2h 13m");
  });

  it("describes missing response stats", () => {
    expect(formatAgentResponseTime(null)).toBe("No responses yet");
  });
});
