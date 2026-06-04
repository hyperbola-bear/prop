import type { ListingSummary } from "../../../../packages/shared/src/types";
import { bedroomsForFlatType, formatAvailableDate, formatSGD } from "../../lib/format";
import { FavoriteToggle } from "./FavoriteToggle";

type ListingCardProps = {
  listing: ListingSummary;
  initialFavorited?: boolean;
};

export function ListingCard({ listing, initialFavorited = false }: ListingCardProps) {
  const [photo] = listing.photos;
  const bedrooms = listing.bedrooms
    ? `${listing.bedrooms} bedrooms`
    : bedroomsForFlatType(listing.flat_type);

  return (
    <article
      data-testid="listing-card"
      data-published-at={listing.published_at ?? ""}
      data-refreshed-at={listing.refreshed_at ?? ""}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="relative">
        <a href={`/listings/${listing.id}`} aria-label={`View ${listing.title}`}>
          <img
            src={
              photo?.url ??
              "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='500'%3E%3Crect width='100%25' height='100%25' fill='%23ccfbf1'/%3E%3C/svg%3E"
            }
            alt={photo?.alt || listing.title}
            className="h-48 w-full object-cover"
          />
        </a>
        <div className="absolute right-3 top-3 z-10">
          <FavoriteToggle listingId={listing.id} initialFavorited={initialFavorited} />
        </div>
      </div>

      <div className="flex min-h-72 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold leading-snug text-slate-950">
            <a href={`/listings/${listing.id}`} className="hover:text-proppy-primary">
              {listing.title}
            </a>
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
        <p className="line-clamp-2 text-sm text-slate-600">
          {listing.description ?? "Singapore HDB rental listing"}
        </p>

        <dl className="mt-auto grid grid-cols-2 gap-3 text-sm text-slate-700">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Flat type</dt>
            <dd className="font-semibold">{listing.flat_type}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Bedrooms</dt>
            <dd className="font-semibold">{bedrooms}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Lease</dt>
            <dd className="font-semibold">{listing.lease_months} months</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Available</dt>
            <dd className="font-semibold">{formatAvailableDate(listing.available_from)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Furnishing</dt>
            <dd className="font-semibold">
              {listing.furnishing === "Fully" ? "Fully furnished" : listing.furnishing}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Room type</dt>
            <dd className="font-semibold">{listing.room_only ? "Room-only" : "Whole unit"}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
