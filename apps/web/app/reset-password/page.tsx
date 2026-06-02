import { ResetPasswordForm } from "./ResetPasswordForm";

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token = "" } = await searchParams;

  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-proppy-primary">
        Password help
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
        Reset password
      </h1>
      <p className="mt-4 text-slate-700">
        Choose a new strong password for your Proppy account.
      </p>
      {!token ? (
        <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
          Missing reset token.
        </p>
      ) : null}
      <ResetPasswordForm token={token} />
    </main>
  );
}
