import type { ListingSummary } from "../../../packages/shared/src/types";
import { bedroomsForFlatType, formatSGD } from "../lib/format";
import { serverApiClient } from "../lib/api-client";

export const dynamic = "force-dynamic";

function ListingCard({ listing }: { listing: ListingSummary }) {
  const [photo] = listing.photos;

  return (
    <a
      data-testid="listing-card"
      href={`/listings/${listing.id}`}
      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <img
        src={photo?.url ?? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='500'%3E%3Crect width='100%25' height='100%25' fill='%23ccfbf1'/%3E%3C/svg%3E"}
        alt={photo?.alt || listing.title}
        className="h-48 w-full object-cover"
      />
      <article className="flex min-h-56 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold leading-snug text-slate-950 group-hover:text-proppy-primary">
            {listing.title}
          </h2>
          <span
            data-testid="listing-price"
            className="shrink-0 rounded-full bg-teal-50 px-3 py-1 text-sm font-bold text-proppy-primary"
          >
            {formatSGD(listing.price_sgd)}
          </span>
        </div>
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
          {listing.address.town}
        </p>
        <dl className="mt-auto grid grid-cols-2 gap-3 text-sm text-slate-700">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Flat type
            </dt>
            <dd className="font-semibold">{listing.flat_type}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              Bedrooms
            </dt>
            <dd className="font-semibold">
              {bedroomsForFlatType(listing.flat_type)}
            </dd>
          </div>
        </dl>
      </article>
    </a>
  );
}

export default async function Home() {
  const { items } = await serverApiClient().listings.list({ limit: 20 });

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-12">
      <section className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-proppy-primary">
          Singapore HDB rentals
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          Browse rentals in Singapore
        </h1>
        <p className="mt-4 text-lg text-slate-700">
          Discover verified HDB rental homes across Singapore towns with clear
          prices, photos, flat details, and lease terms.
        </p>
      </section>

      <section
        aria-label="Rental listings"
        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        {items.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </section>
    </main>
  );
}
