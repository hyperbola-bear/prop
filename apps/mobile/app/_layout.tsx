import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Slot } from "expo-router";
import { useState } from "react";
import { AuthProvider } from "../lib/auth-context";

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Slot />
      </AuthProvider>
    </QueryClientProvider>
  );
}
