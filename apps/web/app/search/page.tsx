import { Suspense } from "react";
import type { ListListingsOptions } from "../../../../packages/shared/src/api-client";
import { ListingCard } from "../../components/listings/ListingCard";
import { DynamicMapView } from "../../components/search/DynamicMapView";
import { FilterPanel } from "../../components/search/FilterPanel";
import { MapToggle } from "../../components/search/MapToggle";
import { RadiusFilter } from "../../components/search/RadiusFilter";
import { SaveSearchButton } from "../../components/search/SaveSearchButton";
import { SortSelect } from "../../components/search/SortSelect";
import { serverApiClient } from "../../lib/api-client";
import { getFavoriteListingIds } from "../../lib/listings";
import { currentSessionUser } from "../../lib/server-auth";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const LISTING_OPTION_KEYS = [
  "town",
  "flat_type",
  "bedrooms",
  "price_min",
  "price_max",
  "lease_min_months",
  "available_from",
  "furnishing",
  "room_only",
  "q",
  "sort",
  "near_mrt",
  "radius_km",
  "view",
  "limit",
  "cursor"
] as const;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function optionsFromSearchParams(
  params: Record<string, string | string[] | undefined>
): ListListingsOptions {
  const options: Record<string, string | number | boolean | null> = { limit: 50 };

  for (const key of LISTING_OPTION_KEYS) {
    const value = firstParam(params[key]);
    if (!value) {
      continue;
    }
    if (key === "room_only") {
      options[key] = value === "true";
    } else if (["bedrooms", "price_min", "price_max", "lease_min_months", "radius_km", "limit"].includes(key)) {
      options[key] = Number(value);
    } else {
      options[key] = value;
    }
  }

  return options as ListListingsOptions;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const options = optionsFromSearchParams(params);
  const [user, { items }] = await Promise.all([
    currentSessionUser(),
    serverApiClient().listings.list(options)
  ]);
  const favoriteIds =
    user?.roles.some((role) => role === "buyer" || role === "renter")
      ? await getFavoriteListingIds(user.id)
      : new Set<string>();
  const isMap = firstParam(params.view) === "map";

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-6 py-10">
      <section className="flex flex-col gap-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-proppy-primary">
          Search Singapore HDB rentals
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-950">
              Find your next rental
            </h1>
            <p className="mt-2 text-slate-700">
              Filter by town, flat type, lease, availability, furnishing, and MRT radius.
            </p>
          </div>
          <Suspense fallback={null}>
            <SaveSearchButton />
          </Suspense>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Suspense fallback={null}>
            <FilterPanel />
            <RadiusFilter />
          </Suspense>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Suspense fallback={null}>
              <SortSelect />
              <MapToggle />
            </Suspense>
          </div>

          {items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-lg font-semibold text-slate-700">
              No results
            </p>
          ) : isMap ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
              <DynamicMapView listings={items} />
              <section aria-label="Visible listings" className="grid max-h-[520px] gap-4 overflow-auto pr-1">
                {items.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    initialFavorited={favoriteIds.has(listing.id)}
                  />
                ))}
              </section>
            </div>
          ) : (
            <section aria-label="Search results" className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {items.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  initialFavorited={favoriteIds.has(listing.id)}
                />
              ))}
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
