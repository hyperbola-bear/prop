export type AuthFormErrors = Record<string, string>;

export function validateSignupFields(input: {
  password: string;
  pdpaConsent: boolean;
}): AuthFormErrors {
  const errors: AuthFormErrors = {};

  if (input.password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  } else if (!/[0-9]/.test(input.password)) {
    errors.password = "Password must include at least one number";
  } else if (!/[^A-Za-z0-9]/.test(input.password)) {
    errors.password = "Password must include at least one special character";
  }

  if (!input.pdpaConsent) {
    errors.pdpaConsent = "PDPA consent is required";
  }

  return errors;
}

export function shouldShowCeaRegistrationInput(role: string): boolean {
  return role === "agent";
}

export function authErrorMessage(payload: unknown, fallback: string): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }

  return fallback;
}
