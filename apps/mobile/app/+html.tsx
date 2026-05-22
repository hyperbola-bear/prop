import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en-SG">
      <body>{children}</body>
    </html>
  );
}
