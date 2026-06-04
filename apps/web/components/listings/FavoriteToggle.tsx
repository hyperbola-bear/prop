"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";

type FavoriteToggleProps = {
  listingId: string;
  initialFavorited?: boolean;
};

function FavoriteToggleInner({
  listingId,
  initialFavorited = false
}: FavoriteToggleProps) {
  const [isFavorited, setIsFavorited] = useState(initialFavorited);

  const mutation = useMutation({
    mutationFn: async (nextFavorited: boolean) => {
      const response = await fetch(`/api/listings/${listingId}/favorite`, {
        method: nextFavorited ? "POST" : "DELETE"
      });
      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!response.ok) {
        throw new Error(`Favorite toggle failed with HTTP ${response.status}`);
      }
    },
    onMutate: async (nextFavorited) => {
      setIsFavorited(nextFavorited);
    },
    onError: (_error, nextFavorited) => {
      setIsFavorited(!nextFavorited);
    }
  });

  return (
    <button
      data-testid="favorite-toggle"
      type="button"
      aria-pressed={isFavorited}
      aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
      disabled={mutation.isPending}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        mutation.mutate(!isFavorited);
      }}
      className={`rounded-full border px-3 py-2 text-lg shadow-sm transition disabled:cursor-wait disabled:opacity-60 ${
        isFavorited
          ? "border-rose-200 bg-rose-50 text-rose-600"
          : "border-slate-200 bg-white text-slate-600 hover:border-rose-200 hover:text-rose-600"
      }`}
    >
      {isFavorited ? "♥" : "♡"}
    </button>
  );
}

export function FavoriteToggle(props: FavoriteToggleProps) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <FavoriteToggleInner {...props} />
    </QueryClientProvider>
  );
}
