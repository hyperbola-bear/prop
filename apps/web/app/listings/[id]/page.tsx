import { notFound } from "next/navigation";
import {
  bedroomsForFlatType,
  formatAvailableDate,
  formatSGD
} from "../../../lib/format";
import { serverApiClient } from "../../../lib/api-client";

export const dynamic = "force-dynamic";

type ListingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ListingDetailPage({
  params
}: ListingDetailPageProps) {
  const { id } = await params;
  const api = serverApiClient();
  const listing = await api.listings.get(id).catch(() => null);

  if (!listing) {
    notFound();
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
        <section>
          <p className="text-sm font-semibold uppercase tracking-wide text-proppy-primary">
            {listing.address.town}
          </p>
          <h1
            data-testid="listing-title"
            className="mt-3 text-4xl font-bold tracking-tight text-slate-950"
          >
            {listing.title}
          </h1>
          <p className="mt-4 text-lg text-slate-700">
            {listing.description}
          </p>
        </section>

        <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p
            data-testid="listing-price"
            className="text-3xl font-bold text-proppy-primary"
          >
            {formatSGD(listing.price_sgd)}
          </p>
          <p className="mt-2 text-sm text-slate-600">Monthly rent</p>
          <dl className="mt-6 grid gap-4 text-sm">
            <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
              <dt className="text-slate-600">Flat type</dt>
              <dd data-testid="listing-flat-type" className="font-semibold">
                {listing.flat_type}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
              <dt className="text-slate-600">Bedrooms</dt>
              <dd className="font-semibold">
                {bedroomsForFlatType(listing.flat_type)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
              <dt className="text-slate-600">Floor area</dt>
              <dd data-testid="listing-flat-area" className="font-semibold">
                {listing.floor_area_sqft} sqft
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
              <dt className="text-slate-600">Lease term</dt>
              <dd data-testid="listing-lease-term" className="font-semibold">
                {listing.lease_months} months
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
              <dt className="text-slate-600">Available from</dt>
              <dd
                data-testid="listing-available-from"
                className="font-semibold"
              >
                {formatAvailableDate(listing.available_from)}
              </dd>
            </div>
          </dl>
        </aside>
      </div>

      <section
        data-testid="listing-gallery"
        aria-label="Listing photo gallery"
        className="mt-10 grid gap-4 sm:grid-cols-3"
      >
        {listing.photos.map((photo, index) => (
          <img
            key={`${photo.url}-${index}`}
            src={photo.url}
            alt={photo.alt || `${listing.title} photo ${index + 1}`}
            className="h-64 w-full rounded-2xl object-cover shadow-sm"
          />
        ))}
      </section>
    </main>
  );
}
