export default function AccountPrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-proppy-primary">
        Privacy
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
        Account privacy
      </h1>
      <p className="mt-4 text-slate-700">
        Manage your personal data and PDPA rights for your Proppy account.
      </p>
      <section className="mt-8 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <a href="/api/me/export" className="font-semibold text-proppy-primary">
          Download my data
        </a>
        <a href="/account/delete" className="font-semibold text-red-700">
          Delete my account
        </a>
      </section>
    </main>
  );
}
