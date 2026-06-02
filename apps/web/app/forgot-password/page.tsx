import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-proppy-primary">
        Password help
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
        Forgot password
      </h1>
      <p className="mt-4 text-slate-700">
        Enter your email and we will send a reset link through Mailpit in dev.
      </p>
      <ForgotPasswordForm />
    </main>
  );
}
