"use client";

import { useState } from "react";
import { authErrorMessage } from "../../lib/auth-ui";

export function ResetPasswordForm({ token }: { token: string }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/auth/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        newPassword: String(formData.get("password") ?? "")
      })
    });
    const payload: unknown = await response.json().catch(() => null);

    setIsSubmitting(false);
    if (!response.ok) {
      setError(authErrorMessage(payload, "Could not reset password"));
      return;
    }

    setMessage("Password reset. You can now log in.");
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-5">
      <div>
        <label htmlFor="reset-password" className="block text-sm font-semibold text-slate-700">
          New password
        </label>
        <input
          id="reset-password"
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
      </div>
      {error ? <p role="alert" className="text-sm font-semibold text-red-700">{error}</p> : null}
      {message ? <p role="status" className="text-sm font-semibold text-teal-800">{message}</p> : null}
      <button
        type="submit"
        disabled={isSubmitting || !token}
        className="rounded-full bg-proppy-primary px-6 py-3 font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Resetting…" : "Reset password"}
      </button>
    </form>
  );
}
