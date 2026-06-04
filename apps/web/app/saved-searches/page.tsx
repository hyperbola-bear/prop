import { redirect } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { savedSearches } from "../../../../packages/db/schema";
import { NotifyEmailToggle } from "../../components/search/NotifyEmailToggle";
import { db } from "../../lib/db";
import { currentSessionUser } from "../../lib/server-auth";

export const dynamic = "force-dynamic";

export default async function SavedSearchesPage() {
  const user = await currentSessionUser();
  if (!user) {
    redirect("/login");
  }

  const rows = await db
    .select()
    .from(savedSearches)
    .where(and(eq(savedSearches.userId, user.id), isNull(savedSearches.deletedAt)))
    .orderBy(desc(savedSearches.createdAt), desc(savedSearches.id));

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-proppy-primary">
          Alerts and saved filters
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
          Saved searches
        </h1>
        <p className="mt-2 text-slate-700">
          Reopen your filters and choose whether matching new listings should email you.
        </p>
      </section>

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-lg font-semibold text-slate-700">
          No results
        </p>
      ) : (
        <section aria-label="Saved searches" className="grid gap-4">
          {rows.map((savedSearch) => {
            const params = new URLSearchParams();
            const query = savedSearch.query as Record<string, string | number | boolean>;
            for (const [key, value] of Object.entries(query)) {
              params.set(key, String(value));
            }

            return (
              <article
                key={savedSearch.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div>
                  <h2 className="text-lg font-bold text-slate-950">{savedSearch.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {Object.entries(query)
                      .map(([key, value]) => `${key}: ${String(value)}`)
                      .join(" · ")}
                  </p>
                  <a
                    href={`/search?${params.toString()}`}
                    className="mt-3 inline-flex text-sm font-bold text-proppy-primary"
                  >
                    Open search
                  </a>
                </div>
                <NotifyEmailToggle
                  savedSearchId={savedSearch.id}
                  initialNotifyEmail={savedSearch.notifyEmail}
                />
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
