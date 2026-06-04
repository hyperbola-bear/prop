import { redirect } from "next/navigation";
import { ListingCard } from "../../components/listings/ListingCard";
import { getFavoriteListings } from "../../lib/listings";
import { currentSessionUser } from "../../lib/server-auth";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const user = await currentSessionUser();
  if (!user) {
    redirect("/login");
  }

  const { items } = await getFavoriteListings(user.id);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-10">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-proppy-primary">
          Pinned rentals
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
          Favorites
        </h1>
        <p className="mt-2 text-slate-700">
          Your favorited listings are saved here for quick comparison.
        </p>
      </section>

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-lg font-semibold text-slate-700">
          No results
        </p>
      ) : (
        <section aria-label="Favorite listings" className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {items.map((listing) => (
            <ListingCard key={listing.id} listing={listing} initialFavorited />
          ))}
        </section>
      )}
    </main>
  );
}
