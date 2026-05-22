import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Proppy",
  description: "Singapore-first property marketplace"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
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
            <a
              data-testid="nav-signin"
              href="/login"
              className="rounded-full border border-proppy-primary px-4 py-2 text-sm font-semibold text-proppy-primary transition hover:bg-proppy-primary hover:text-white"
            >
              Sign in
            </a>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
