import { redirect } from "next/navigation";
import { currentSessionUser } from "../../lib/server-auth";
import { AddSellerRoleButton } from "./AddSellerRoleButton";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await currentSessionUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-proppy-primary">
        Account
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
        Your profile
      </h1>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <dl className="grid gap-5">
          <div>
            <dt className="text-sm font-semibold text-slate-600">Email</dt>
            <dd className="mt-1 text-lg text-slate-950">{user.email}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-600">Phone</dt>
            <dd className="mt-1 text-lg text-slate-950">{user.phone}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-slate-600">Roles</dt>
            <dd className="mt-2 flex flex-wrap gap-2">
              {user.roles.map((role) => (
                <span
                  key={role}
                  className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700"
                >
                  {role}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </section>

      {!user.roles.includes("seller") ? <AddSellerRoleButton /> : null}
    </main>
  );
}
