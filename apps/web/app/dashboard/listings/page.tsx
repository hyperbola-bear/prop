import { redirect } from "next/navigation";
import { currentSessionUser } from "../../../lib/server-auth";
import { OwnedListingsTable } from "./OwnedListingsTable";

export default async function DashboardListingsPage() {
  const user = await currentSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-proppy-primary">
            Dashboard
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
            Your listings
          </h1>
          <p className="mt-3 text-slate-600">
            Edit, pause, refresh, mark rented, or delist your HDB rental listings.
          </p>
        </div>
        <a
          href="/listings/new"
          className="rounded-full bg-proppy-primary px-6 py-3 text-center font-bold text-white hover:bg-teal-800"
        >
          Create listing
        </a>
      </div>
      <OwnedListingsTable />
    </main>
  );
}
