import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-proppy-primary">
        Welcome back
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
        Sign in
      </h1>
      <p className="mt-4 text-slate-700">
        Access your saved searches, profile, and property management tools.
      </p>
      <LoginForm />
    </main>
  );
}
