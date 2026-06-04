import { describe, expect, it } from "vitest";
import { scoreMessage } from "../index";

describe("scoreMessage", () => {
  it("flags deposit-before-viewing pressure", () => {
    const result = scoreMessage("Please pay deposit before viewing to reserve the unit.");

    expect(result.scam_flags).toContain("deposit_before_viewing");
    expect(result.scam_score).toBe(40);
  });

  it("emits crypto and offsite payment flags for bitcoin requests", () => {
    const result = scoreMessage("Send the holding fee by Bitcoin today.");

    expect(result.scam_flags).toEqual(expect.arrayContaining(["crypto", "offsite_payment"]));
    expect(result.scam_score).toBeGreaterThanOrEqual(30);
  });

  it("flags off-platform handoff attempts", () => {
    const result = scoreMessage("WhatsApp me at +6591234567 for details.");

    expect(result.scam_flags).toContain("whatsapp_handoff");
    expect(result.scam_score).toBeGreaterThanOrEqual(25);
  });

  it("combines M4 scam assertion flags and clamps score", () => {
    const result = scoreMessage("WhatsApp me at +6591234567 and pay deposit by Bitcoin");

    expect(result.scam_flags).toEqual(
      expect.arrayContaining(["whatsapp_handoff", "crypto", "offsite_payment"])
    );
    expect(result.scam_score).toBeGreaterThanOrEqual(70);
    expect(result.scam_score).toBeLessThanOrEqual(100);
  });

  it("does not flag ordinary rental questions", () => {
    expect(scoreMessage("Hello, is the unit pet-friendly?")).toEqual({
      scam_flags: [],
      scam_score: 0
    });
  });
});
