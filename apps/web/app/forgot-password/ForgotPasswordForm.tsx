"use client";

import { useState } from "react";
import { authErrorMessage } from "../../lib/auth-ui";

export function ForgotPasswordForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/auth/password/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: String(formData.get("email") ?? "") })
    });
    const payload: unknown = await response.json().catch(() => null);

    setIsSubmitting(false);
    if (!response.ok) {
      setError(authErrorMessage(payload, "Could not send reset email"));
      return;
    }

    setMessage("Check your email");
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-5">
      <div>
        <label htmlFor="forgot-email" className="block text-sm font-semibold text-slate-700">
          Email
        </label>
        <input
          id="forgot-email"
          data-testid="auth-email-input"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
        />
      </div>
      {error ? <p role="alert" className="text-sm font-semibold text-red-700">{error}</p> : null}
      {message ? <p role="status" className="text-sm font-semibold text-teal-800">{message}</p> : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-full bg-proppy-primary px-6 py-3 font-bold text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60"
      >
        {isSubmitting ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
