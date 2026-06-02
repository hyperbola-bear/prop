import { VerifyPhoneForm } from "./VerifyPhoneForm";

export const dynamic = "force-dynamic";

type VerifyPhonePageProps = {
  searchParams: Promise<{ phone?: string }>;
};

export default async function VerifyPhonePage({ searchParams }: VerifyPhonePageProps) {
  const { phone = "" } = await searchParams;

  return (
    <main className="mx-auto min-h-screen max-w-xl px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-proppy-primary">
        OTP verification
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950">
        Verify your phone
      </h1>
      <p className="mt-4 text-slate-700">
        Enter the six-digit code sent to {phone || "your Singapore mobile number"}.
        In development, use <strong>000000</strong>.
      </p>
      <VerifyPhoneForm phone={phone} />
    </main>
  );
}
