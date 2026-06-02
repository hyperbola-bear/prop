"use client";

import { useState } from "react";

type AuthNavProps = {
  user: { email: string } | null;
};

export function AuthNav({ user }: AuthNavProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setIsSigningOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  if (!user) {
    return (
      <a
        data-testid="nav-signin"
        href="/login"
        className="rounded-full border border-proppy-primary px-4 py-2 text-sm font-semibold text-proppy-primary transition hover:bg-proppy-primary hover:text-white"
      >
        Sign in
      </a>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <a
        data-testid="nav-profile"
        href="/profile"
        className="text-sm font-semibold text-slate-700 hover:text-proppy-primary"
      >
        {user.email}
      </a>
      <button
        data-testid="nav-signout"
        type="button"
        onClick={signOut}
        disabled={isSigningOut}
        className="rounded-full border border-proppy-primary px-4 py-2 text-sm font-semibold text-proppy-primary transition hover:bg-proppy-primary hover:text-white disabled:cursor-wait disabled:opacity-60"
      >
        {isSigningOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}
