"use client";

import { useState } from "react";
import { authErrorMessage } from "../../../lib/auth-ui";

export function VerifyPhoneForm({ phone }: { phone: string }) {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setError("");

    const response = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        code: String(formData.get("otp") ?? "")
      })
    });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      setError(authErrorMessage(payload, "Invalid OTP code"));
      setIsSubmitting(false);
      return;
    }

    window.location.href = "/";
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-5">
      <div>
        <label htmlFor="auth-otp" className="block text-sm font-semibold text-slate-700">
          One-time password
        </label>
        <input
          id="auth-otp"
          data-testid="auth-otp-input"
          name="otp"
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          autoComplete="one-time-code"
          placeholder="000000"
          required
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
        />
      </div>
      {error ? <p role="alert" className="text-sm font-semibold text-red-700">{error}</p> : null}
      <button
        data-testid="auth-otp-submit"
        type="submit"
        disabled={isSubmitting}
        className="rounded-full bg-proppy-primary px-6 py-3 font-bold text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60"
      >
        {isSubmitting ? "Verifying…" : "Verify phone"}
      </button>
    </form>
  );
}
