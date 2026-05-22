export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-proppy-primary">
        Proppy
      </p>
      <h1 className="text-4xl font-bold">Browse rentals in Singapore</h1>
      <p className="max-w-2xl text-lg text-slate-700">
        The marketplace foundation is ready. Listing data and browse surfaces
        will be filled in by the next milestone workers.
      </p>
      <a
        data-testid="nav-signin"
        className="mt-4 inline-flex w-fit rounded-md bg-proppy-primary px-4 py-2 font-semibold text-white"
        href="/login"
      >
        Sign in
      </a>
    </main>
  );
}
