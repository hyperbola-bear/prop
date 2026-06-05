import { describe, expect, it } from "vitest";
import {
  authErrorMessage,
  shouldShowCeaRegistrationInput,
  validateSignupFields
} from "./auth-ui";

describe("validateSignupFields", () => {
  it("reports PDPA consent when the signup checkbox is not ticked", () => {
    expect(
      validateSignupFields({ password: "Test!234", pdpaConsent: false })
    ).toMatchObject({ pdpaConsent: "PDPA consent is required" });
  });

  it("reports weak password requirements inline", () => {
    expect(
      validateSignupFields({ password: "abc", pdpaConsent: true })
    ).toMatchObject({ password: "Password must be at least 8 characters" });
  });
});

describe("authErrorMessage", () => {
  it("extracts API error messages when available", () => {
    expect(
      authErrorMessage(
        { error: { code: "invalid_credentials", message: "Invalid email or password" } },
        "Fallback"
      )
    ).toBe("Invalid email or password");
  });
});

describe("shouldShowCeaRegistrationInput", () => {
  it("shows the CEA registration field only for agent signup role", () => {
    expect(shouldShowCeaRegistrationInput("agent")).toBe(true);
    expect(shouldShowCeaRegistrationInput("buyer")).toBe(false);
    expect(shouldShowCeaRegistrationInput("seller")).toBe(false);
  });
});
