import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  const myInfoEnabled = process.env.AUTH_MYINFO_ENABLED === "true";

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-proppy-primary">
        Join Proppy
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
        Create your account
      </h1>
      <p className="mt-4 text-slate-700">
        Sign up with your email, password, Singapore mobile number, and preferred
        marketplace role.
      </p>

      {myInfoEnabled ? (
        <a
          href="/signup/myinfo-callback"
          className="mt-6 inline-flex rounded-full border border-proppy-primary px-5 py-3 font-semibold text-proppy-primary transition hover:bg-proppy-primary hover:text-white"
        >
          Continue with Singpass
        </a>
      ) : null}

      <SignupForm />
    </main>
  );
}
