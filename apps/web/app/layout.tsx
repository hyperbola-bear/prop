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
      <body>{children}</body>
    </html>
  );
}
