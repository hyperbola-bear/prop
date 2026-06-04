"use client";

import { useEffect, useState } from "react";

type AuthNavProps = {
  user: { email: string } | null;
};

export function AuthNav({ user }: AuthNavProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    async function loadUnreadCount() {
      const response = await fetch("/api/me/unread-count", { cache: "no-store" });
      if (!response.ok) return;
      const body = (await response.json()) as { count: number };
      if (!cancelled) {
        setUnreadCount(body.count);
      }
    }

    void loadUnreadCount();
    const timer = window.setInterval(loadUnreadCount, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user]);

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
        data-testid="nav-favorites"
        href="/favorites"
        className="text-sm font-semibold text-slate-700 hover:text-proppy-primary"
      >
        Favorites
      </a>
      <a
        data-testid="nav-messages"
        href="/messages"
        className="relative text-sm font-semibold text-slate-700 hover:text-proppy-primary"
      >
        Messages
        {unreadCount > 0 ? (
          <span className="ml-2 rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">
            {unreadCount}
          </span>
        ) : (
          <span className="sr-only">0 unread</span>
        )}
      </a>
      <a
        href="/dashboard/listings"
        className="text-sm font-semibold text-slate-700 hover:text-proppy-primary"
      >
        My listings
      </a>
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
