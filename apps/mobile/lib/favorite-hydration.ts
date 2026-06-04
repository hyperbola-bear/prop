import type { ListingSummary } from "@proppy/shared/types";

export function favoriteIdsFromListings(listings: Pick<ListingSummary, "id">[]) {
  return new Set(listings.map((listing) => listing.id));
}

export function isInitiallyFavorited(listingId: string, favoriteIds: ReadonlySet<string>) {
  return favoriteIds.has(listingId);
}

export function canHydrateFavorites(
  token: string | null,
  user: { roles: string[] } | null | undefined
) {
  return Boolean(
    token && user?.roles.some((role) => role === "buyer" || role === "renter")
  );
}
