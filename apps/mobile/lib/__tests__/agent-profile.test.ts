import { describe, expect, it } from "vitest";
import {
  agentReviewTypeLabel,
  fallbackAgentPhoto,
  formatAgentResponseTime,
  initialsForAgent
} from "../agent-profile";

describe("mobile agent profile helpers", () => {
  it("formats missing response-time stats like the web profile", () => {
    expect(formatAgentResponseTime(null)).toBe("No responses yet");
  });

  it("formats minute and hour response-time stats", () => {
    expect(formatAgentResponseTime(42)).toBe("42 min");
    expect(formatAgentResponseTime(120)).toBe("2h");
    expect(formatAgentResponseTime(133)).toBe("2h 13m");
  });

  it("derives stable initials for fallback agent photos", () => {
    expect(initialsForAgent("Alicia Tan")).toBe("AT");
    expect(fallbackAgentPhoto("Alicia Tan")).toContain("data:image/svg+xml,");
  });

  it("labels review confidence types", () => {
    expect(agentReviewTypeLabel("verified")).toBe("Verified");
    expect(agentReviewTypeLabel("unverified")).toBe("Unverified");
  });
});
