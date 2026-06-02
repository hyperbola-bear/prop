"use client";

import { useState } from "react";
import { authErrorMessage } from "../../lib/auth-ui";

export function LoginForm() {
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? "")
      })
    });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      setError(authErrorMessage(payload, "Invalid email or password"));
      setIsSubmitting(false);
      return;
    }

    window.location.href = "/";
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-5">
      <div>
        <label htmlFor="login-email" className="block text-sm font-semibold text-slate-700">
          Email
        </label>
        <input
          id="login-email"
          data-testid="auth-email-input"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
        />
      </div>
      <div>
        <label htmlFor="login-password" className="block text-sm font-semibold text-slate-700">
          Password
        </label>
        <input
          id="login-password"
          data-testid="auth-password-input"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950"
        />
      </div>
      {error ? <p role="alert" className="text-sm font-semibold text-red-700">{error}</p> : null}
      <button
        data-testid="auth-signin-submit"
        type="submit"
        disabled={isSubmitting}
        className="rounded-full bg-proppy-primary px-6 py-3 font-bold text-white transition hover:bg-teal-800 disabled:cursor-wait disabled:opacity-60"
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
      <a href="/forgot-password" className="text-sm font-semibold text-proppy-primary">
        Forgot password?
      </a>
    </form>
  );
}
