"use client";

import { useState } from "react";
import { authErrorMessage, type AuthFormErrors, validateSignupFields } from "../../lib/auth-ui";

type MyInfoPayload = {
  name: string;
  uinfin: string;
  nationality?: string;
  dob?: string;
  sex?: string;
  mobileno?: string;
};

type SignupFormProps = {
  initialName?: string;
  initialNric?: string;
  initialPhone?: string;
  myinfoPayload?: MyInfoPayload;
};

function apiFieldErrors(payload: unknown): AuthFormErrors {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "fieldErrors" in payload.error &&
    typeof payload.error.fieldErrors === "object" &&
    payload.error.fieldErrors !== null
  ) {
    return payload.error.fieldErrors as AuthFormErrors;
  }

  return {};
}

export function SignupForm({
  initialName = "",
  initialNric = "",
  initialPhone = "+65",
  myinfoPayload
}: SignupFormProps) {
  const [errors, setErrors] = useState<AuthFormErrors>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const pdpaConsent = formData.get("pdpaConsent") === "on";
    const password = String(formData.get("password") ?? "");
    const validationErrors = validateSignupFields({ password, pdpaConsent });

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setFormError("");
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    setFormError("");

    const phone = String(formData.get("phone") ?? "");
    const body = {
      email: String(formData.get("email") ?? ""),
      password,
      phone,
      role: String(formData.get("role") ?? "buyer"),
      pdpaConsent,
      ...(myinfoPayload
        ? {
            name: String(formData.get("name") ?? myinfoPayload.name),
            myinfoPayload
          }
        : {})
    };

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const fieldErrors = apiFieldErrors(payload);
      setErrors(fieldErrors);
      setFormError(authErrorMessage(payload, "Signup failed"));
      setIsSubmitting(false);
      return;
    }

    window.location.href = `/signup/verify-phone?phone=${encodeURIComponent(phone)}`;
  }

  return (
    <form noValidate onSubmit={onSubmit} className="mt-8 grid gap-5">
      {myinfoPayload ? (
        <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
          Singpass MyInfo mock completed. Review the prefilled details, then
          create your Proppy account.
        </div>
      ) : null}

      {myinfoPayload ? (
        <>
          <div>
            <label htmlFor="signup-name" className="block text-sm font-semibold text-slate-700">
              Full name
            </label>
            <input
              id="signup-name"
              name="name"
              type="text"
              defaultValue={initialName}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
            />
          </div>
          <div>
            <label htmlFor="signup-nric" className="block text-sm font-semibold text-slate-700">
              NRIC
            </label>
            <input
              id="signup-nric"
              name="nric"
              type="text"
              defaultValue={initialNric}
              readOnly
              className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-950"
            />
          </div>
        </>
      ) : null}

      <div>
        <label htmlFor="signup-email" className="block text-sm font-semibold text-slate-700">
          Email
        </label>
        <input
          id="signup-email"
          data-testid="auth-email-input"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
        />
        {errors.email ? <p className="mt-2 text-sm text-red-700">{errors.email}</p> : null}
      </div>

      <div>
        <label htmlFor="signup-password" className="block text-sm font-semibold text-slate-700">
          Password
        </label>
        <input
          id="signup-password"
          data-testid="auth-password-input"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
        />
        <p className="mt-2 text-sm text-slate-600">
          Use at least 8 characters with a number and special character.
        </p>
        {errors.password ? <p className="mt-2 text-sm text-red-700">{errors.password}</p> : null}
      </div>

      <div>
        <label htmlFor="signup-phone" className="block text-sm font-semibold text-slate-700">
          Phone (+65 prefix)
        </label>
        <input
          id="signup-phone"
          data-testid="auth-phone-input"
          name="phone"
          type="tel"
          autoComplete="tel"
          defaultValue={initialPhone}
          required
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
        />
        {errors.phone ? <p className="mt-2 text-sm text-red-700">{errors.phone}</p> : null}
      </div>

      <div>
        <label htmlFor="signup-role" className="block text-sm font-semibold text-slate-700">
          Role
        </label>
        <select
          id="signup-role"
          name="role"
          required
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
        >
          <option value="buyer">buyer/renter</option>
          <option value="seller">seller/landlord</option>
          <option value="agent">agent</option>
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start gap-3">
          <input
            id="signup-pdpa"
            name="pdpaConsent"
            type="checkbox"
            required
            className="mt-1 h-5 w-5 rounded border-slate-300 text-proppy-primary"
          />
          <label htmlFor="signup-pdpa" className="text-sm text-slate-700">
            I consent to the PDPA terms and allow Proppy to process my personal
            data for account creation.
          </label>
        </div>
        {errors.pdpaConsent ? (
          <p className="mt-2 text-sm font-semibold text-red-700">{errors.pdpaConsent}</p>
        ) : null}
      </div>

      {formError ? <p role="alert" className="text-sm font-semibold text-red-700">{formError}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-full bg-proppy-primary px-6 py-3 font-bold text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60"
      >
        {isSubmitting ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
