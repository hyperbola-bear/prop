import type { Metadata } from "next";
import { AuthNav } from "../components/AuthNav";
import { currentSessionUser } from "../lib/server-auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Proppy",
  description: "Singapore-first property marketplace"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await currentSessionUser();

  return (
    <html lang="en-SG">
      <body>
        <header className="border-b border-slate-200 bg-white/90">
          <nav
            aria-label="Main navigation"
            className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"
          >
            <a
              data-testid="nav-listings"
              href="/"
              className="text-lg font-bold text-proppy-primary"
            >
              Proppy
            </a>
            <AuthNav user={user ? { email: user.email } : null} />
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
